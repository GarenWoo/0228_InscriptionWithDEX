// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {WETH9} from '../src/Uniswap_v2_periphery/WETH9.sol';
import {UniswapV2Router02_Customized} from '../src/Uniswap_v2_periphery/UniswapV2Router02_Customized.sol';
import {UniswapV2Factory_Customized} from '../src/Uniswap_v2_core/UniswapV2Factory_Customized.sol';
import {FairTokenGFT_V2} from '../src/FairTokenGFT_V2.sol';
import {ERC20TokenFactory_V2} from '../src/ERC20TokenFactory_V2.sol';
import {UniswapV2Library_Customized} from "../src/Uniswap_v2_periphery/libraries/UniswapV2Library_Customized.sol";
import {UniswapV2Pair_Customized} from "../src/Uniswap_v2_core/UniswapV2Pair_Customized.sol";

import {Test, console} from "forge-std/Test.sol";

contract ERC20TokenFactory_V2_Test is Test {
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    WETH9 public WETHContract;
    UniswapV2Factory_Customized public UNI_FactoryContract;
    UniswapV2Router02_Customized public UNI_RouterContract;
    FairTokenGFT_V2 public implementContract;
    ERC20TokenFactory_V2 public inscriptFactoryContract;

    address public WETHAddr;
    address public UNI_FactoryAddr;
    address public UNI_RouterAddr;
    address public implementAddr;
    address public inscriptFactoryAddr;
    

    function setUp() public {
        vm.startPrank(alice);
        WETHContract = new WETH9();
        WETHAddr = address(WETHContract);
        UNI_FactoryContract = new UniswapV2Factory_Customized(alice);
        UNI_FactoryAddr = address(UNI_FactoryContract);
        UNI_RouterContract = new UniswapV2Router02_Customized(UNI_FactoryAddr, WETHAddr);
        UNI_RouterAddr = address(UNI_RouterContract);
        implementContract = new FairTokenGFT_V2();
        implementAddr = address(implementContract);
        inscriptFactoryContract = new ERC20TokenFactory_V2(implementAddr, UNI_RouterAddr);
        inscriptFactoryAddr = address(inscriptFactoryContract);
        vm.stopPrank();
    }

    function test_DeployInscription() public {
        deal(alice, 200000 ether);
        vm.startPrank(alice);
        address inscriptAddr = inscriptFactoryContract.deployInscription("OpenSpace Token", "OT", 10000, 1000, 1000000 gwei);
        string memory inscriptName = inscriptFactoryContract.getInscriptionInfo(inscriptAddr).name;
        string memory inscriptSymbol = inscriptFactoryContract.getInscriptionInfo(inscriptAddr).symbol;
        uint256 inscriptTotalSupply = inscriptFactoryContract.getInscriptionInfo(inscriptAddr).totalSupply;
        uint256 inscriptPerMint = inscriptFactoryContract.getInscriptionInfo(inscriptAddr).perMint;
        vm.stopPrank();
        assertEq(inscriptName, "OpenSpace Token", "Expected name of the inscription is 'OpenSpace Token'!");
        assertEq(inscriptSymbol, "OT", "Expected symbol of the inscription is 'OT'!");
        assertEq(inscriptTotalSupply, 10000, "Expected totalSupply of the inscription is 10000!");
        assertEq(inscriptPerMint, 1000, "Expected perMint of the inscription is 1000!");
    }

    function test_MintInscription() public {
        deal(alice, 200000 ether);
        vm.startPrank(alice);
        uint256 fee = 1000000 gwei;
        address inscriptAddr = inscriptFactoryContract.deployInscription("OpenSpace Token", "OT", 10000, 1000, fee);
        uint256 inscriptPerMint = inscriptFactoryContract.getInscriptionInfo(inscriptAddr).perMint;
        FairTokenGFT_V2 inscriptInstance = FairTokenGFT_V2(inscriptAddr);    // the newly deployed inscription instance
        inscriptFactoryContract.mintInscription{value: 1000000 gwei}(inscriptAddr);
        uint256 tokenInUser = inscriptInstance.balanceOf(alice);
        uint256 tokenInInscriptFactory = inscriptInstance.balanceOf(inscriptFactoryAddr);
        address pair = UniswapV2Library_Customized.pairFor(UNI_FactoryAddr, inscriptAddr, WETHAddr);
        uint256 tokenInPair = FairTokenGFT_V2(inscriptAddr).balanceOf(pair);
        uint256 WETHInPair = WETH9(WETHAddr).balanceOf(pair);
        uint256 LPInInscriptFactory = UniswapV2Pair_Customized(pair).balanceOf(inscriptFactoryAddr);
        console.log('tokenInUser:');
        console.log(tokenInUser);
        console.log('tokenInInscriptFactory:');
        console.log(tokenInInscriptFactory);
        console.log('pair:');
        console.log(pair);
        console.log('tokenInPair:');
        console.log(tokenInPair);
        console.log('WETHInPair:');
        console.log(WETHInPair);
        console.log('LPInInscriptFactory:');
        console.log(LPInInscriptFactory);
        vm.stopPrank();
        assertTrue(tokenInUser >= inscriptPerMint / 2, "Expect the inscription balance of user larger than half of perMint");
        assertTrue(tokenInInscriptFactory <= inscriptPerMint / 2, "Expect the inscription balance of the inscription factory equal to or less than half of perMint");
        assertTrue(tokenInPair <= inscriptPerMint / 2, "Expect the token amount in pair is not more than half of perMint");
        assertTrue(WETHInPair <= fee / 2, "Expect the WETH amount in pair is not more than half of perMint");
    }

    function test_withdrawProfitFromMinting() public {
        deal(alice, 20 ether);
        deal(bob, 20 ether);
        vm.startPrank(alice);
        uint256 fee = 10 ether;
        address inscriptAddr = inscriptFactoryContract.deployInscription("OpenSpace Token", "OT", 10000, 1000, fee);
        vm.startPrank(bob);
        inscriptFactoryContract.mintInscription{value: fee}(inscriptAddr);
        address pair = UniswapV2Library_Customized.pairFor(UNI_FactoryAddr, inscriptAddr, WETHAddr);
        console.log('Alice ETH balance | Before Withdrawal:');
        console.log(alice.balance);
        vm.startPrank(alice);
        inscriptFactoryContract.withdrawProfitFromMinting(5 ether);
        console.log('Alice ETH balance | After Withdrawal:');
        console.log(alice.balance);
        vm.stopPrank();
        assertTrue(alice.balance >= 25 ether, "Expect the Alice ETH balance equal to or larger than 25 ether");
    }

    function test_withdrawProfitFromLiquidity() public {
        deal(alice, 1 ether);
        deal(bob, 1 ether);
        vm.startPrank(alice);
        UNI_FactoryContract.setFeeTo(alice);
        uint256 fee = 10**15;
        address inscriptAddr = inscriptFactoryContract.deployInscription("OpenSpace Token", "OT", 10**15, 10**12, fee);
        inscriptFactoryContract.mintInscription{value: fee}(inscriptAddr);
        address pair = UniswapV2Library_Customized.pairFor(UNI_FactoryAddr, inscriptAddr, WETHAddr);
        vm.startPrank(bob);
        address[] memory _path1 = new address[](2);
        _path1[0] = WETHAddr;
        _path1[1] = inscriptAddr;
        address[] memory _path2 = new address[](2);
        _path2[0] = inscriptAddr;
        _path2[1] = WETHAddr;
        uint256 swapTokenAmount = 10000;

        UNI_RouterContract.swapExactETHForTokens{value: 1 gwei}(1, _path1, bob, block.timestamp + 120);
        FairTokenGFT_V2(inscriptAddr).approve(UNI_RouterAddr, swapTokenAmount);
        UNI_RouterContract.swapExactTokensForETH(swapTokenAmount, 0, _path2, bob, block.timestamp + 120);
        

        UNI_RouterContract.swapExactETHForTokens{value: 1 gwei}(1, _path1, bob, block.timestamp + 120);
        FairTokenGFT_V2(inscriptAddr).approve(UNI_RouterAddr, swapTokenAmount);
        UNI_RouterContract.swapExactTokensForETH(swapTokenAmount, 0, _path2, bob, block.timestamp + 120);

        UNI_RouterContract.swapExactETHForTokens{value: 1 gwei}(1, _path1, bob, block.timestamp + 120);
        FairTokenGFT_V2(inscriptAddr).approve(UNI_RouterAddr, swapTokenAmount);
        UNI_RouterContract.swapExactTokensForETH(swapTokenAmount, 0, _path2, bob, block.timestamp + 120);

        UNI_RouterContract.swapExactETHForTokens{value: 1 gwei}(1, _path1, bob, block.timestamp + 120);
        FairTokenGFT_V2(inscriptAddr).approve(UNI_RouterAddr, swapTokenAmount);
        UNI_RouterContract.swapExactTokensForETH(swapTokenAmount, 0, _path2, bob, block.timestamp + 120);

        vm.stopPrank();
        uint256 inscriptionOfBob = FairTokenGFT_V2(inscriptAddr).balanceOf(bob);
        console.log('inscriptionOfBob:');
        console.log(inscriptionOfBob);
        uint256 inscriptionInPair = FairTokenGFT_V2(inscriptAddr).balanceOf(pair);
        console.log('inscriptionInPair:');
        console.log(inscriptionInPair);
        assertTrue(inscriptionOfBob > 0, "Expect the inscription balance of Bob is more than 0");
        vm.startPrank(alice);
        uint256 withdrawableLP = inscriptFactoryContract.getLPProfitAmount(inscriptAddr);
        uint256 totalSupply = UniswapV2Pair_Customized(pair).totalSupply();
        console.log('withdrawableLP:');
        console.log(withdrawableLP);
        console.log('LP Total Supply:');
        console.log(totalSupply + withdrawableLP);
        (uint256 tokenAmount, uint256 ETHAmount) = inscriptFactoryContract.withdrawProfitFromLiquidity(inscriptAddr, 290, 0, 0);
        vm.stopPrank();
        assertTrue(tokenAmount > 0 && ETHAmount > 0, "Expect inscription and ETH corresponding to earned LP token are all larger than 0!");
    }

}
