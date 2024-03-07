// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {FairTokenGFT_V2} from "./FairTokenGFT_V2.sol";
import {UniswapV2Library_Customized} from "./Uniswap_v2_periphery/libraries/UniswapV2Library_Customized.sol";
import {UniswapV2Router02_Customized} from "./Uniswap_v2_periphery/UniswapV2Router02_Customized.sol";
import {UniswapV2Pair_Customized} from "./Uniswap_v2_core/UniswapV2Pair_Customized.sol";

/**
 * @title This is a factory contract that deploys inscription (ERC-20 token) contract instances by cloning a logic contract that provides the implementation of the inscription.
 * The new features of version V2:
 * 1. Now, users are required to pay an amount of ETH to mint incription
 * 2. Half of the minted inscription(tokens) and half of the cost(ETH) will be added to DEX as liquidity.
 * 3. The liquidity cannot be removed. All the liquidity profits belong to the project party of this inscription.
 * 4. The liquidity profits can be withdrawn by the project party.
 *
 * @author Garen Woo
 */
contract ERC20TokenFactory_V2 is Ownable {
    using Clones for address;

    // This is the address of the implement contract(template of ERC20Token contract)
    address private libraryAddress;
    address public routerAddress;

    struct InscriptionStruct {
        string name;
        string symbol;
        uint256 totalSupply;
        uint256 perMint;
        uint256 mintFeeInETH;
    }

    mapping(address inscriptionAddr => InscriptionStruct info) public inscriptionInfo;
    uint256 private LPAmount_AddingLiquidity;       // the amount of LP token which come from adding liquidity only
    uint256 private profitOfMint;                   // the amount of ETH from the account which mints inscription
    uint256 private profitOfLP;                     // the amount of ETH from providing liquidity(the pair of the inscription and WETH)

    event InscriptionCreated(address instanceAddress);
    event InscriptionMinted(address inscriptAddr, uint256 mintedAmount, uint256 liquidityAdd);
    event LiquidityProfitWithdrawn(
        address indexed inscriptAddr, uint256 LPAmount, uint256 indexed tokenAmount, uint256 indexed ETHAmount
    );
    event MintingProfitWithdrawn(address owner, uint256 withdrawnAmount);

    error InsufficientETHGiven(address user, uint256 valueSent);
    error InvalidAmountMintedBack(address inscriptAddr, uint256 mintedAmount, uint256 expectedAmount);
    error ReachMaxSupply(address inscriptAddr, uint256 currentSupply, uint256 mintedAmount, uint256 maxSupply);
    error InsufficientProfitOfMint(uint256 balance, uint256 withdrawnAmount);

    /**
     * @notice maxAmountOfInscription is a deterministic number that limits the maximum amount of inscription.
     * This parameter set a cap to avoid transaction failure which results from over-high gas.
     * This state variable can be modified by owner of this factory.
     */
    uint256 public maxAmountOfInscription = 1000000;

    constructor(address _libraryAddress, address _routerAddress) Ownable(msg.sender) {
        libraryAddress = _libraryAddress;
        routerAddress = _routerAddress;
    }

    receive() external payable {
        if (msg.sender == routerAddress) {
            profitOfLP += msg.value;
        }
    }

    /**
     * @dev Using the implement contract of libraryAddress, deploy its contract instance.
     *
     * @param _tokenName the name of the ERC20 token contract that will be deployed
     * @param _tokenSymbol the symbol of the ERC20 token contract that will be deployed
     * @param _tokenTotalSupply the maximum of the token supply(if this maximum is reached, token cannot been minted any more)
     * @param _perMint the fixed amount of token that can be minted once
     */
    function deployInscription(
        string memory _tokenName,
        string memory _tokenSymbol,
        uint256 _tokenTotalSupply,
        uint256 _perMint,
        uint256 _mintFeeInETH
    ) public returns (address) {
        require(_tokenTotalSupply != 0 && _tokenTotalSupply % 2 == 0, "Total Supply should be an even non-zero number");
        require(_perMint != 0 && _perMint % 2 == 0, "Minted amount should be an even non-zero number");
        address clonedImpleInstance = libraryAddress.clone();
        InscriptionStruct memory deployedInscription = InscriptionStruct({
            name: _tokenName,
            symbol: _tokenSymbol,
            totalSupply: _tokenTotalSupply,
            perMint: _perMint,
            mintFeeInETH: _mintFeeInETH
        });
        inscriptionInfo[clonedImpleInstance] = deployedInscription;
        FairTokenGFT_V2(clonedImpleInstance).init(address(this), _tokenName, _tokenSymbol);
        emit InscriptionCreated(clonedImpleInstance);
        return clonedImpleInstance;
    }

    /**
     * @dev Mint fixed amount of token in the contract of '_tokenAddr'.
     *
     * @param _tokenAddr the address of the contract instance which is cloned from the implement contract
     */
    function mintInscription(address _tokenAddr) public payable {
        _beforeMintInscription(_tokenAddr);
        uint256 halfMintedToken = inscriptionInfo[_tokenAddr].perMint / 2;
        uint256 halfFee = msg.value / 2;
        uint256 balanceBefore = FairTokenGFT_V2(_tokenAddr).balanceOf(address(this));
        FairTokenGFT_V2(_tokenAddr).mint(address(this), halfMintedToken);
        FairTokenGFT_V2(_tokenAddr).mint(msg.sender, halfMintedToken);
        uint256 balanceAfter = FairTokenGFT_V2(_tokenAddr).balanceOf(address(this));
        if (balanceAfter <= balanceBefore || balanceAfter - balanceBefore != halfMintedToken) {
            uint256 balanceDelta = balanceAfter <= balanceBefore ? 0 : balanceAfter - balanceBefore;
            revert InvalidAmountMintedBack(_tokenAddr, balanceDelta, halfMintedToken);
        }
        // Approve DEX router
        bool isApproved = FairTokenGFT_V2(_tokenAddr).approve(routerAddress, halfMintedToken);
        require(isApproved, "Fail to approve");
        // Add liquidity
        (uint256 amountToken, uint256 amountETH, uint256 liquidity) = UniswapV2Router02_Customized(
            payable(routerAddress)
        ).addLiquidityETH{value: halfFee}(_tokenAddr, halfMintedToken, 0, 0, address(this), block.timestamp + 600);
        uint256 tokenToBeRefunded = halfMintedToken - amountToken;
        if (tokenToBeRefunded > 0) {
            bool _ok = FairTokenGFT_V2(_tokenAddr).transfer(msg.sender, halfMintedToken - amountToken);
            require(_ok, "Fail to refund inscription");
        }
        uint256 ETHToBeRefunded = halfFee - amountETH;
        if (ETHToBeRefunded > 0) {
            (bool _success,) = payable(msg.sender).call{value: halfFee - amountETH}("");
            require(_success, "Fail to refund ETH");
        }
        LPAmount_AddingLiquidity += liquidity;
        profitOfMint += halfFee;
        emit InscriptionMinted(_tokenAddr, inscriptionInfo[_tokenAddr].perMint, liquidity);
    }

    /**
     * @dev Withdraw the profit from inscription minting
     */
    function withdrawProfitFromMinting(uint256 _amount) external onlyOwner {
        address owner = owner();
        if (_amount > address(this).balance) {
            revert InsufficientProfitOfMint(profitOfMint, _amount);
        }
        profitOfMint -= _amount;
        payable(owner).call{value: _amount}("");
        emit MintingProfitWithdrawn(owner, _amount);
    }

    /**
     * @dev Withdraw the profit from the earned LP tokens
     *
     * @param _tokenAddr the address of the specific inscription
     * @param _LPAmountWithdrawn the amount of the LP tokens which are used for the withdrawn
     * @param _tokenMin the minimum amount of the inscription withdrawn from the DEX
     * @param _ETHMin the minimum amount of ETH withdrawn from the DEX
     */
    function withdrawProfitFromLiquidity(
        address _tokenAddr,
        uint256 _LPAmountWithdrawn,
        uint256 _tokenMin,
        uint256 _ETHMin
    ) external onlyOwner returns (uint256 tokenAmount, uint256 ETHAmount) {
        address owner = owner();
        address pair = getPairAddress(_tokenAddr);
        bool isApproved = UniswapV2Pair_Customized(pair).approve(routerAddress, _LPAmountWithdrawn);
        require(isApproved, "Fail to approve router");
        (tokenAmount, ETHAmount) = UniswapV2Router02_Customized(payable(routerAddress)).withdrawProfitFromLiquidityETH(
            _tokenAddr, _LPAmountWithdrawn, _tokenMin, _ETHMin, address(this), block.timestamp + 600
        );
        bool _ok = FairTokenGFT_V2(_tokenAddr).transfer(owner, tokenAmount);
        require(_ok, "Fail to withdraw token");
        (bool _success,) = payable(owner).call{value: ETHAmount}("");
        require(_success, "Fail to withdraw ETH");
        emit LiquidityProfitWithdrawn(_tokenAddr, _LPAmountWithdrawn, tokenAmount, ETHAmount);
    }

    /**
     * @dev Replace the address of the implement contract with a new one.
     * This function can only be called by the owner of this factory contract.
     */
    function setLibraryAddress(address _libraryAddr) public onlyOwner {
        libraryAddress = _libraryAddr;
    }

    /**
     * @dev Update the maximum of the ERC20 token contract instances
     */
    function setMaxAmountOfInscription(uint256 _newMaximum) external onlyOwner {
        maxAmountOfInscription = _newMaximum;
    }

    // ------------------------------------------------------ ** Functions with View-modifier ** ------------------------------------------------------

    /**
     * @notice This function is used to get the current total amount of minted token. It's for the convenience of knowing
     * if the current total amount has reached the maximum.
     *
     * @param _tokenAddr the address of the contract instance which is cloned from the implement contract
     */
    function getInscriptionCurrentSupply(address _tokenAddr) public view returns (uint256) {
        return FairTokenGFT_V2(_tokenAddr).totalSupply();
    }

    /**
     * @dev Get the current address of the implement contract
     */
    function getLibraryAddress() public view returns (address) {
        return libraryAddress;
    }

    /**
     * @dev Get the information of the inscription at `_inscriptionAddr`.
     */
    function getInscriptionInfo(address _inscriptionAddr) public view returns (InscriptionStruct memory) {
        return inscriptionInfo[_inscriptionAddr];
    }

    /**
     * @dev Get the amount of LP token which come from adding liquidity only.(i.e. the LP token corresponding to the staked inscription and WETH in DEX)
     */
    function getLPTokenAmountOnlyAddingLiquidity() external view onlyOwner returns (uint256) {
        return LPAmount_AddingLiquidity;
    }

    /**
     * @dev Get the earned profit from providing liquidity.
     */
    function getLPProfitAmount(address _inscriptionAddr) public view onlyOwner returns (uint256) {
        address pair = getPairAddress(_inscriptionAddr);
        uint256 liquidityAdded = UniswapV2Pair_Customized(pair).estimateFee();
        return liquidityAdded;
    }

    function getPairAddress(address _inscriptionAddr) public view returns (address) {
        address factory = UniswapV2Router02_Customized(payable(routerAddress)).factory();
        address WETHAddress = UniswapV2Router02_Customized(payable(routerAddress)).WETH();
        address pairAddress = UniswapV2Library_Customized.pairFor(factory, _inscriptionAddr, WETHAddress);
        return pairAddress;
    }

    /**
     * @dev Get the current amount of profit(in ETH) from minting inscriptions.
     */
    function getProfitFromMinting() public view onlyOwner returns (uint256) {
        return profitOfMint;
    }

    /**
     * @dev Get the current amount of profit(in ETH) from minting inscriptions.
     */
    function getProfitFromProvidingLiquidity() public view onlyOwner returns (uint256) {
        return profitOfLP;
    }

    // ------------------------------------------------------ ** Internal Functions ** ------------------------------------------------------

    function _beforeMintInscription(address _tokenAddr) internal view {
        uint256 currentTotalSupply = FairTokenGFT_V2(_tokenAddr).totalSupply();
        uint256 amountPerMint = inscriptionInfo[_tokenAddr].perMint;
        uint256 maxSupply = inscriptionInfo[_tokenAddr].totalSupply;
        if (currentTotalSupply + amountPerMint > maxSupply) {
            revert ReachMaxSupply(_tokenAddr, currentTotalSupply, amountPerMint, maxSupply);
        }
        if (msg.value < inscriptionInfo[_tokenAddr].mintFeeInETH) {
            revert InsufficientETHGiven(msg.sender, msg.value);
        }
    }
}
