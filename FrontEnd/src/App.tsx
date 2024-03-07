import "./App.css";
import { useState, useEffect, useRef } from "react";
import { formatBalance, formatChainInDecimalAsString } from "./utils";
import { ethers } from "ethers";
import NFTMarketABI from "./utils/NFTMarketABI.json";
import ERC777TokenGTTABI from "./utils/ERC777TokenGTTABI.json";
import ERC721TokenABI from "./utils/ERC721Token.json";
import ERC20TokenFactoryABI from "./utils/ERC20TokenFactory_V2.json";

interface WalletState {
  accounts: string[];
  signer: ethers.JsonRpcSigner | null;
  chainId: string;
  balance: number | string;
}
interface NFTListStatus {
  [NFTAddress: string]: number[];
}
interface ListedInscriptionStatus {
  [NFTAddressFactory: string]: string[];
}
let network_RPC_URL: string = "";
let GTTAddress: string = "";
let NFTMarketAddress: string = "";
let inscriptFactoryAddr: string = "";
let GTTContract: ethers.Contract;
let NFTMarket: ethers.Contract;
let ERC721TokenContract: ethers.Contract;
let scanURL: string = "";
let TxURL_List: string | null = null;
let TxURL_Delist: string | null = null;
let TxURL_Buy: string | null = null;
let inputCounter: number = 0;
let valuesOfMerkleTree: any[] = [];
// let ListedNFT: NFTListStatus = {}
const initialState = { accounts: [], signer: null, balance: "", chainId: "" };
const App = () => {
  const [ListedNFT, setListedNFT] = useState<NFTListStatus>({});
  const [ListedInscription, setListedInscription] = useState<ListedInscriptionStatus>({});
  const [wallet, setWallet] = useState<WalletState>(initialState);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isNFTMarketApproved, setisNFTMarketApproved] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [GTTBalance, setGTTBalance] = useState<number | string>("");
  const NFTAddressRef_List = useRef<HTMLInputElement>(null);
  const tokenIdRef_List = useRef<HTMLInputElement>(null);
  const NFTPriceRef_List = useRef<HTMLInputElement>(null);
  const NFTAddressRef_Delist = useRef<HTMLInputElement>(null);
  const tokenIdRef_Delist = useRef<HTMLInputElement>(null);
  const NFTAddressRef_Buy = useRef<HTMLInputElement>(null);
  const tokenIdRef_Buy = useRef<HTMLInputElement>(null);
  const bidValueRef_Buy = useRef<HTMLInputElement>(null);
  const disableConnect = Boolean(wallet) && isConnecting;

  // ERC20-Permit depositTokenWithPermit@SuperBank
  const ERC20Permit_Name = useRef<HTMLInputElement>(null);
  const ERC20Permit_ChainId = useRef<HTMLInputElement>(null);
  const ERC20Permit_VerifyingContract = useRef<HTMLInputElement>(null);
  const ERC20Permit_Spender = useRef<HTMLInputElement>(null);
  const ERC20Permit_Value = useRef<HTMLInputElement>(null);
  const ERC20Permit_Deadline = useRef<HTMLInputElement>(null);
  const ERC20Permit_SignerAddress = useRef<HTMLInputElement>(null);

  // NFT-Permit buyWithPermit@NFTMarket
  const ERC721Permit_Buy_Name = useRef<HTMLInputElement>(null);
  const ERC721Permit_Buy_ChainId = useRef<HTMLInputElement>(null);
  const ERC721Permit_Buy_VerifyingContract = useRef<HTMLInputElement>(null);
  const ERC721Permit_Buy_Buyer = useRef<HTMLInputElement>(null);
  const ERC721Permit_Buy_TokenId = useRef<HTMLInputElement>(null);
  const ERC721Permit_Buy_Deadline = useRef<HTMLInputElement>(null);

  // NFT-Permit listWithPermit@NFTMarket
  const ERC721Permit_List_Name = useRef<HTMLInputElement>(null);
  const ERC721Permit_List_ChainId = useRef<HTMLInputElement>(null);
  const ERC721Permit_List_VerifyingContract = useRef<HTMLInputElement>(null);
  const ERC721Permit_List_Operator = useRef<HTMLInputElement>(null);
  const ERC721Permit_List_TokenId = useRef<HTMLInputElement>(null);
  const ERC721Permit_List_Price = useRef<HTMLInputElement>(null);
  const ERC721Permit_List_Deadline = useRef<HTMLInputElement>(null);

  // Merkle Tree Building And Generation of Merkle Proof
  let valueOfParam0_MerkleTree = useRef<HTMLInputElement>(null);
  let valueOfParam1_MerkleTree = useRef<HTMLInputElement>(null);
  let valueOfParam2_MerkleTree = useRef<HTMLInputElement>(null);
  let typeOfParam0_MerkleTree = useRef<HTMLInputElement>(null);
  let typeOfParam1_MerkleTree = useRef<HTMLInputElement>(null);
  let typeOfParam2_MerkleTree = useRef<HTMLInputElement>(null);

  // Generate Whitelist Data(only NFT Project Party):
  const NFTAddr_WhitelistData = useRef<HTMLInputElement>(null);
  const MerkleRoot_WhitelistData = useRef<HTMLInputElement>(null);

  // Claim NFT:
  const NFTMarketAddr_ClaimNFT = useRef<HTMLInputElement>(null);

  // Sign typed data for AirDrop of NFT
  const name_AirDropOfNFT = useRef<HTMLInputElement>(null);
  const chainId_AirDropOfNFT = useRef<HTMLInputElement>(null);
  const verifyingContract_AirDropOfNFT = useRef<HTMLInputElement>(null);
  const spender_AirDropOfNFT = useRef<HTMLInputElement>(null);
  const tokenAmount_AirDropOfNFT = useRef<HTMLInputElement>(null);
  const deadline_AirDropOfNFT = useRef<HTMLInputElement>(null);

  // Claim NFT(Multicall):
  const name_AirDropOfNFT_MultiCall = useRef<HTMLInputElement>(null);
  const chainId_AirDropOfNFT_MultiCall = useRef<HTMLInputElement>(null);
  const verifyingContract_AirDropOfNFT_MultiCall =
    useRef<HTMLInputElement>(null);
  const spender_AirDropOfNFT_MultiCall = useRef<HTMLInputElement>(null);
  const tokenAmount_AirDropOfNFT_MultiCall = useRef<HTMLInputElement>(null);

  // Create Inscription
  const name_DeployInscription = useRef<HTMLInputElement>(null);
  const symbol_DeployInscription = useRef<HTMLInputElement>(null);
  const totalSupply_DeployInscription = useRef<HTMLInputElement>(null);
  const perMint_DeployInscription = useRef<HTMLInputElement>(null);
  const mintFeeInETH_DeployInscription = useRef<HTMLInputElement>(null);

  // Mint Inscription
  const inscriptAddr_MintInscription = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    let provider: ethers.BrowserProvider;
    const refreshAccounts = async () => {
      const accounts = await _updateAccounts();
      _updateState(accounts);
    };

    const refreshChain = async (rawChainId: any) => {
      const chainId = formatChainInDecimalAsString(rawChainId);
      const accounts = await _updateAccounts();
      const balance = await _updateBalance(accounts);
      setWallet((wallet) => ({ ...wallet, balance, chainId }));
      _updateInfoOfChain(chainId);
      _updateContract();
      await _updateTokenBalance(accounts);
    };

    const initialization = async () => {
      provider = new ethers.BrowserProvider(window.ethereum);
      if (provider) {
        if (wallet.accounts.length > 0) {
          refreshAccounts();
        } else {
          setWallet(initialState);
        }

        window.ethereum.on("accountsChanged", refreshAccounts);
        window.ethereum.on("chainChanged", refreshChain);
      }
    };

    initialization();

    return () => {
      window.ethereum?.removeListener("accountsChanged", refreshAccounts);
      window.ethereum?.removeListener("chainChanged", refreshChain);
    };
  }, []);

  const handleNFTMarket_List = async () => {
    const NFTAddress = NFTAddressRef_List.current?.value;
    const tokenId = tokenIdRef_List.current?.value;
    const NFTPrice = NFTPriceRef_List.current?.value;
    const isApproved = await NFTMarket.CheckIfApprovedByNFT(
      NFTAddress,
      tokenId
    );
    const ownerOfNFT = await NFTMarket.getOwner(NFTAddress, tokenId);
    try {
      if (ownerOfNFT == NFTMarketAddress) {
        setError(true);
        setErrorMessage("This NFT has already listed in this NFTMarket");
        if (NFTAddress && tokenId) {
          const tokenIdNum = parseInt(tokenId);
          setListedNFT((prevListedNFT) => {
            const updatedList = { ...prevListedNFT };
            if (!updatedList[NFTAddress]) {
              updatedList[NFTAddress] = [];
            }
            updatedList[NFTAddress].push(tokenIdNum);
            return updatedList;
          });
        }
        setError(false);
        return;
      }
      if (!isApproved) {
        setError(true);
        setErrorMessage(
          "Before listing NFT, this NFTMarket should be approved by corresponding NFT in advance"
        );
        setisNFTMarketApproved(false);
        return;
      }
      let tx = await NFTMarket.list(NFTAddress, tokenId, NFTPrice);
      TxURL_List = scanURL + "tx/" + tx.hash;
      const receipt = await tx.wait();
      _updateStateAfterTx(receipt);
      if (receipt) {
        if (NFTAddress && tokenId) {
          const tokenIdNum = parseInt(tokenId);
          setListedNFT((prevListedNFT) => {
            const updatedList = { ...prevListedNFT };
            if (!updatedList[NFTAddress]) {
              updatedList[NFTAddress] = [];
            }
            updatedList[NFTAddress].push(tokenIdNum);
            return updatedList;
          });
        }
      }
      setError(false);
    } catch (err: any) {
      setError(true);
      setErrorMessage(err.message);
    }
  };

  const handleNFTMarket_Delist = async () => {
    const NFTAddress = NFTAddressRef_Delist.current?.value;
    const tokenId = tokenIdRef_Delist.current?.value;
    const ownerOfNFT = await NFTMarket.getOwner(NFTAddress, tokenId);
    try {
      if (ownerOfNFT != NFTMarketAddress) {
        setError(true);
        setErrorMessage("This NFT is not listed in this NFTMarket");
        return;
      }
      let tx = await NFTMarket.delist(NFTAddress, tokenId);
      const receipt = await tx.wait();
      _updateStateAfterTx(receipt);
      if (receipt) {
        if (NFTAddress && tokenId) {
          const tokenIdNum = parseInt(tokenId);
          if (ListedNFT[NFTAddress]) {
            const updatedTokenIds = ListedNFT[NFTAddress].filter(
              (id) => id !== tokenIdNum
            );
            if (updatedTokenIds.length === 0) {
              const updatedListedNFT = { ...ListedNFT };
              delete updatedListedNFT[NFTAddress];
              setListedNFT(updatedListedNFT);
            } else {
              setListedNFT({ ...ListedNFT, [NFTAddress]: updatedTokenIds });
            }
          }
        }
      }
      TxURL_Delist = scanURL + "tx/" + tx.hash;
      setError(false);
    } catch (err: any) {
      setError(true);
      setErrorMessage(err.message);
    }
  };

  const handleNFTMarket_Buy = async () => {
    const NFTAddress = NFTAddressRef_Buy.current?.value;
    const tokenId = tokenIdRef_Buy.current?.value;
    const bidValue = bidValueRef_Buy.current?.value;
    const ownerOfNFT = await NFTMarket.getOwner(NFTAddress, tokenId);
    try {
      if (ownerOfNFT != NFTMarketAddress) {
        setError(true);
        setErrorMessage("This NFT has not listed in this NFTMarket");
        return;
      }
      let tx = await NFTMarket.buy(NFTAddress, tokenId, bidValue);
      TxURL_Buy = scanURL + "tx/" + tx.hash;
      const receipt = await tx.wait();
      _updateStateAfterTx(receipt);
      setError(false);
    } catch (err: any) {
      setError(true);
      setErrorMessage(err.message);
    }
  };

  const handleNFT_Approve = async () => {
    let provider = new ethers.BrowserProvider(window.ethereum);
    let signer = await provider.getSigner();
    const NFTAddress = NFTAddressRef_List.current?.value;
    const tokenId = tokenIdRef_List.current?.value;
    if (NFTAddress) {
      ERC721TokenContract = new ethers.Contract(
        NFTAddress,
        ERC721TokenABI,
        signer
      );
    }
    const tx = await ERC721TokenContract.approve(NFTMarketAddress, tokenId);
    const receipt = await tx.wait();
    _updateStateAfterTx(receipt);
    if (receipt) {
      setisNFTMarketApproved(true);
    }
    setError(false);
  };

  const _updateStateAfterTx = (receipt: any) => {
    if (receipt) {
      _updateBalance(wallet.accounts);
      _updateTokenBalance(wallet.accounts);
    }
  };

  const _updateInfoOfChain = (chainId: string) => {
    switch (chainId) {
      // Mumbai
      case "80001":
        GTTAddress = "0xDBaA831fc0Ff91FF67A3eD5C6c708E6854CE6EfF";
        NFTMarketAddress = "0xF0B5972a88F201B1a83d87a1de2a6569d66fac58";
        inscriptFactoryAddr = "";
        scanURL = "https://mumbai.polygonscan.com/";
        network_RPC_URL = "https://polygon-mumbai-pokt.nodies.app";
        break;

      // Ethereum Goerli
      case "5":
        GTTAddress = "0x6307230425563aA7D0000213f579516159CDf84a";
        NFTMarketAddress = "0xAFD443aF73e81BFBA794124083b4C71aEbdC25BF";
        inscriptFactoryAddr = "";
        scanURL = "https://goerli.etherscan.io/";
        network_RPC_URL = "https://ethereum-goerli.publicnode.com";
        break;

      // Ethereum Sepolia
      case "11155111":
        GTTAddress = "0x3490ff3bc24146AA6140e1efd5b0A0fAAEda39E9";
        NFTMarketAddress = "0x15f5748131bF26caa4eF66978743e15A473C1475";
        inscriptFactoryAddr = "0x888018d0De977D9DaAfA127303A7eccE01A1E80f";
        scanURL = "https://sepolia.etherscan.io/";
        network_RPC_URL = "https://ethereum-sepolia.publicnode.com";
        break;

      // Hardhat Node(Local)
      case "31337":
        network_RPC_URL = "http://localhost:8545";
        break;

      default:
        GTTAddress = "";
        NFTMarketAddress = "";
        scanURL = "";
        network_RPC_URL = "";
    }
  };

  const _updateState = async (accounts: any) => {
    const chainId = await _updateChainId();
    const balance = await _updateBalance(accounts);
    let provider = new ethers.BrowserProvider(window.ethereum);
    let signer = await provider.getSigner();
    if (accounts.length > 0) {
      setWallet({ ...wallet, accounts, chainId, signer, balance });
    } else {
      setWallet(initialState);
    }
    _updateInfoOfChain(chainId);
    await _updateContract();
    await _updateTokenBalance(accounts);
  };

  const _updateContract = async () => {
    let provider = new ethers.BrowserProvider(window.ethereum);
    let signer = await provider.getSigner();
    NFTMarket = new ethers.Contract(NFTMarketAddress, NFTMarketABI, signer);
    GTTContract = new ethers.Contract(GTTAddress, ERC777TokenGTTABI, signer);
  };

  const _updateBalance = async (accounts: any) => {
    const balance = formatBalance(
      await window.ethereum!.request({
        method: "eth_getBalance",
        params: [accounts[0], "latest"],
      })
    );
    return balance;
  };

  const _updateTokenBalance = async (accounts: any) => {
    setGTTBalance(formatBalance(await GTTContract.balanceOf(accounts[0])));
  };

  const _updateAccounts = async () => {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    return accounts;
  };

  const _updateChainId = async () => {
    const chainId = formatChainInDecimalAsString(
      await window.ethereum!.request({
        method: "eth_chainId",
      })
    );
    setWallet({ ...wallet, chainId });
    return chainId;
  };

  const getLogs = async (fromBlock: number, toBlock: number) => {
    // const userAddress = wallet.accounts[0]
    let filter = {
      fromBlock,
      toBlock,
      address: NFTMarketAddress,
    };
    let provider = new ethers.BrowserProvider(window.ethereum);
    let currentBlock = await provider.getBlockNumber();
    if (filter.toBlock > currentBlock) {
      filter.toBlock = currentBlock;
    }
    provider.getLogs(filter).then((logs) => {
      if (logs.length > 0) decodeEvents(logs);
      if (currentBlock <= fromBlock && logs.length == 0) {
        // console.log("begin monitor")
        // 方式1，继续轮训
        // setTimeout(() => {
        //     getLogs(fromBlock, toBlock)
        // }, 2000);
        // 方式2: 监听
        NFTMarket.on("NFTListed", function (a0, a1, a2, event) {
          decodeEvents([event.log]);
        });
        NFTMarket.on("NFTDelisted", function (a0, a1, event) {
          decodeEvents([event.log]);
        });
        NFTMarket.on("NFTBought", function (a0, a1, a2, event) {
          decodeEvents([event.log]);
        });
      } else {
        getLogs(toBlock + 1, toBlock + 1 + 200);
      }
    });
  };

  /**
   * @dev Decode events of NFT trades
   */
  function decodeEvents(logs: any) {
    const event_NFTListed = NFTMarket.getEvent("NFTListed").fragment;
    const event_NFTDelisted = NFTMarket.getEvent("NFTDelisted").fragment;
    const event_NFTBought = NFTMarket.getEvent("NFTBought").fragment;

    for (var i = 0; i < logs.length; i++) {
      const item = logs[i];
      const eventId = item.topics[0];
      if (eventId == event_NFTListed.topicHash) {
        const data = NFTMarket.interface.decodeEventLog(
          event_NFTListed,
          item.data,
          item.topics
        );
        printLog(
          `NFTListed@Block#${item.blockNumber} | Parameters: { NFTAddress: ${data.NFTAddr}, tokenId: ${data.tokenId}, price: ${data.price} } (${item.transactionHash})`
        );
      } else if (eventId == event_NFTDelisted.topicHash) {
        const data = NFTMarket.interface.decodeEventLog(
          event_NFTDelisted,
          item.data,
          item.topics
        );
        printLog(
          `NFTDelisted@Block#${item.blockNumber} | Parameters: { NFTAddress:${data.NFTAddr}, tokenId: ${data.tokenId} } (${item.transactionHash})`
        );
      }
      if (eventId == event_NFTBought.topicHash) {
        const data = NFTMarket.interface.decodeEventLog(
          event_NFTBought,
          item.data,
          item.topics
        );
        printLog(
          `NFTBought@Block#${item.blockNumber} | Parameters: { NFTAddress:${data.NFTAddr}, tokenId: ${data.tokenId}, bidValue: ${data.bidValue} } (${item.transactionHash})`
        );
      }
    }
  }

  // /**
  //  * @dev Decode events of Inscription
  //  */
  // function decodeEvents_Inscription(logs: any) {
  //   const inscriptFactoryAddr = inscriptFactoryAddr_MintInscription.current?.value;
  //   const provider = new ethers.BrowserProvider(window.ethereum);
  //   let inscriptFactoryContract;
  //   if (inscriptFactoryAddr) {
  //     inscriptFactoryContract = new ethers.Contract(inscriptFactoryAddr, ERC20TokenFactoryABI, provider);
  //   } else {
  //     console.log("Invalid address of inscription factory");
  //   }

  //   const event_InscriptionCreated = NFTMarket.getEvent("InscriptionCreated").fragment;
  //   const event_InscriptionMinted = NFTMarket.getEvent("InscriptionMinted").fragment;
  //   const event_NFTBought = NFTMarket.getEvent("NFTBought").fragment;

  //   for (var i = 0; i < logs.length; i++) {
  //     const item = logs[i];
  //     const eventId = item.topics[0];
  //     if (eventId == event_NFTListed.topicHash) {
  //       const data = NFTMarket.interface.decodeEventLog(
  //         event_NFTListed,
  //         item.data,
  //         item.topics
  //       );
  //       printLog(
  //         `NFTListed@Block#${item.blockNumber} | Parameters: { NFTAddress: ${data.NFTAddr}, tokenId: ${data.tokenId}, price: ${data.price} } (${item.transactionHash})`
  //       );
  //     } else if (eventId == event_NFTDelisted.topicHash) {
  //       const data = NFTMarket.interface.decodeEventLog(
  //         event_NFTDelisted,
  //         item.data,
  //         item.topics
  //       );
  //       printLog(
  //         `NFTDelisted@Block#${item.blockNumber} | Parameters: { NFTAddress:${data.NFTAddr}, tokenId: ${data.tokenId} } (${item.transactionHash})`
  //       );
  //     }
  //     if (eventId == event_NFTBought.topicHash) {
  //       const data = NFTMarket.interface.decodeEventLog(
  //         event_NFTBought,
  //         item.data,
  //         item.topics
  //       );
  //       printLog(
  //         `NFTBought@Block#${item.blockNumber} | Parameters: { NFTAddress:${data.NFTAddr}, tokenId: ${data.tokenId}, bidValue: ${data.bidValue} } (${item.transactionHash})`
  //       );
  //     }
  //   }
  // }

  // ERC20-Permit(ERC2612) sign typed data for depositTokenWithPermit@SuperBank
  const signDepositTokenWithPermit_ERC20Permit = async () => {
    const name = ERC20Permit_Name.current?.value;
    const version = "1";
    const chainId = ERC20Permit_ChainId.current?.value;
    const verifyingContract = ERC20Permit_VerifyingContract.current?.value;
    const spender = ERC20Permit_Spender.current?.value;
    const value = ERC20Permit_Value.current?.value;
    const deadline = ERC20Permit_Deadline.current?.value;
    const signerAddress = ERC20Permit_SignerAddress.current?.value;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const owner = await signer.getAddress();
    const tokenAddress = verifyingContract;
    const tokenAbi = ["function nonces(address owner) view returns (uint256)"];
    let tokenContract;
    let nonce;
    if (tokenAddress) {
      tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);
      nonce = await tokenContract.nonces(signerAddress);
    } else {
      console.log("Invalid token address");
    }

    console.log(`signerAddress: ${signerAddress}`);
    console.log(`owner: ${owner}`);

    const domain = {
      name: name,
      version: version,
      chainId: chainId,
      verifyingContract: verifyingContract,
    };

    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const message = {
      owner: owner,
      spender: spender,
      value: value,
      nonce: nonce,
      deadline: deadline,
    };

    try {
      console.log(
        `Domin || name: ${domain.name}, version: ${domain.version}, chainId: ${domain.chainId}, verifyingContract: ${domain.verifyingContract}`
      );
      console.log("Types || Permit: ", JSON.stringify(types.Permit, null, 2));
      console.log(
        `message || owner: ${message.owner}, spender: ${message.spender}, value: ${message.value}, deadline: ${message.deadline}, nonce: ${message.nonce}`
      );
      console.log(`message: ${message}`);
      const signedMessage = await signer.signTypedData(domain, types, message);
      console.log("Signature:", signedMessage);
      const signatureResult = ethers.Signature.from(signedMessage);
      console.log("v: ", signatureResult.v);
      console.log("r: ", signatureResult.r);
      console.log("s: ", signatureResult.s);
    } catch (error) {
      console.error("Error signing permit:", error);
    }
  };

  // ERC721-Permit sign typed data for buyWithPermit@NFTMarket
  const sign_BuyWithPermit_ERC721Permit = async () => {
    const name = ERC721Permit_Buy_Name.current?.value;
    const version = "1";
    const chainId = ERC721Permit_Buy_ChainId.current?.value;
    const verifyingContract = ERC721Permit_Buy_VerifyingContract.current?.value;
    const buyer = ERC721Permit_Buy_Buyer.current?.value;
    const tokenId = ERC721Permit_Buy_TokenId.current?.value;
    const deadline = ERC721Permit_Buy_Deadline.current?.value;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const tokenAddress = verifyingContract;
    const tokenAbi = ["function nonces(address owner) view returns (uint256)"];
    let ERC721WithPermitContract;
    let nonce;
    if (tokenAddress) {
      ERC721WithPermitContract = new ethers.Contract(
        tokenAddress,
        tokenAbi,
        provider
      );
      nonce = await ERC721WithPermitContract.nonces(signerAddress);
    } else {
      console.log("Invalid token address");
    }

    const domain = {
      name: name,
      version: version,
      chainId: chainId,
      verifyingContract: verifyingContract,
    };

    const types = {
      NFTPermit_PrepareForBuy: [
        { name: "buyer", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "signerNonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const message = {
      buyer: buyer,
      tokenId: tokenId,
      signerNonce: nonce,
      deadline: deadline,
    };

    try {
      console.log(
        `ERC721WithPermitContract: ${ERC721WithPermitContract}, signerAddress: ${signerAddress}`
      );
      console.log(
        `Domin || name: ${domain.name}, typeof(name): ${typeof domain.name}`
      );
      console.log(
        `Domin || version: ${
          domain.version
        }, typeof(version): ${typeof domain.version}`
      );
      console.log(
        `Domin || chainId: ${
          domain.chainId
        }, typeof(chainId): ${typeof domain.chainId}`
      );
      console.log(
        `Domin || verifyingContract: ${
          domain.verifyingContract
        }, typeof(verifyingContract): ${typeof domain.verifyingContract}`
      );
      console.log(
        "Types || NFTPermit_PrepareForBuy: ",
        JSON.stringify(types.NFTPermit_PrepareForBuy, null, 2)
      );
      console.log(
        `message || buyer: ${
          message.buyer
        }, typeof(buyer): ${typeof message.buyer}`
      );
      console.log(
        `message || tokenId: ${
          message.tokenId
        }, typeof(tokenId): ${typeof message.tokenId}`
      );
      console.log(
        `message || signerNonce: ${
          message.signerNonce
        }, typeof(signerNonce): ${typeof message.signerNonce}`
      );
      console.log(
        `message || deadline: ${
          message.deadline
        }, typeof(deadline): ${typeof message.deadline}`
      );

      const signedMessage = await signer.signTypedData(domain, types, message);
      console.log("Signature(ERC721-Permit):", signedMessage);
      const signatureResult = ethers.Signature.from(signedMessage);
      console.log("v: ", signatureResult.v);
      console.log("r: ", signatureResult.r);
      console.log("s: ", signatureResult.s);
    } catch (error) {
      console.error("Error signing permit:", error);
    }
  };

  // ERC721-Permit sign typed data for listWithPermit@NFTMarket
  const sign_ListWithPermit_ERC721Permit = async () => {
    const name = ERC721Permit_List_Name.current?.value;
    const version = "1";
    const chainId = ERC721Permit_List_ChainId.current?.value;
    const verifyingContract =
      ERC721Permit_List_VerifyingContract.current?.value;
    const operator = ERC721Permit_List_Operator.current?.value;
    const tokenId = ERC721Permit_List_TokenId.current?.value;
    const price = ERC721Permit_List_Price.current?.value;
    const deadline = ERC721Permit_List_Deadline.current?.value;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const tokenAddress = verifyingContract;
    const tokenAbi = ["function nonces(address owner) view returns (uint256)"];
    let ERC721WithPermitContract;
    let nonce;
    if (tokenAddress) {
      ERC721WithPermitContract = new ethers.Contract(
        tokenAddress,
        tokenAbi,
        provider
      );
      nonce = await ERC721WithPermitContract.nonces(signerAddress);
    } else {
      console.log("Invalid token address");
    }

    const domain = {
      name: name,
      version: version,
      chainId: chainId,
      verifyingContract: verifyingContract,
    };

    const types = {
      NFTPermit_PrepareForList: [
        { name: "operator", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "price", type: "uint256" },
        { name: "signerNonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const message = {
      operator: operator,
      tokenId: tokenId,
      price: price,
      signerNonce: nonce,
      deadline: deadline,
    };

    try {
      console.log(
        `ERC721WithPermitContract: ${ERC721WithPermitContract}, signerAddress: ${signerAddress}`
      );
      console.log(
        `Domin || name: ${domain.name}, typeof(name): ${typeof domain.name}`
      );
      console.log(
        `Domin || version: ${
          domain.version
        }, typeof(version): ${typeof domain.version}`
      );
      console.log(
        `Domin || chainId: ${
          domain.chainId
        }, typeof(chainId): ${typeof domain.chainId}`
      );
      console.log(
        `Domin || verifyingContract: ${
          domain.verifyingContract
        }, typeof(verifyingContract): ${typeof domain.verifyingContract}`
      );
      console.log(
        "Types || NFTPermit_PrepareForList: ",
        JSON.stringify(types.NFTPermit_PrepareForList, null, 2)
      );
      console.log(
        `message || operator: ${
          message.operator
        }, typeof(operator): ${typeof message.operator}`
      );
      console.log(
        `message || tokenId: ${
          message.tokenId
        }, typeof(tokenId): ${typeof message.tokenId}`
      );
      console.log(
        `message || price: ${
          message.price
        }, typeof(price): ${typeof message.price}`
      );
      console.log(
        `message || signerNonce: ${
          message.signerNonce
        }, typeof(signerNonce): ${typeof message.signerNonce}`
      );
      console.log(
        `message || deadline: ${
          message.deadline
        }, typeof(deadline): ${typeof message.deadline}`
      );

      const signedMessage = await signer.signTypedData(domain, types, message);
      console.log("Signature(ERC721-Permit):", signedMessage);
      const signatureResult = ethers.Signature.from(signedMessage);
      console.log("v: ", signatureResult.v);
      console.log("r: ", signatureResult.r);
      console.log("s: ", signatureResult.s);
    } catch (error) {
      console.error("Error signing permit:", error);
    }
  };

  // Sign typed data for approving NFTMarket to operate ERC20 token to get AirDrop of NFT
  const sign_ERC20Permit_AirdropOfNFT = async () => {
    const name = name_AirDropOfNFT.current?.value;
    const version = "1";
    const chainId = chainId_AirDropOfNFT.current?.value;
    const verifyingContract = verifyingContract_AirDropOfNFT.current?.value;
    const spender = spender_AirDropOfNFT.current?.value;
    const value = tokenAmount_AirDropOfNFT.current?.value;
    const deadline = deadline_AirDropOfNFT.current?.value;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const owner = await signer.getAddress();
    const tokenAddress = verifyingContract;
    const tokenAbi = ["function nonces(address owner) view returns (uint256)"];
    let ERC721WithPermitContract;
    let nonce;
    if (tokenAddress) {
      ERC721WithPermitContract = new ethers.Contract(
        tokenAddress,
        tokenAbi,
        provider
      );
      nonce = await ERC721WithPermitContract.nonces(owner);
    } else {
      console.log("Invalid token address");
    }

    const domain = {
      name: name,
      version: version,
      chainId: chainId,
      verifyingContract: verifyingContract,
    };

    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const message = {
      owner: owner,
      spender: spender,
      value: value,
      nonce: nonce,
      deadline: deadline,
    };

    try {
      console.log("Types || Permit: ", JSON.stringify(types.Permit, null, 2));
      console.log(
        `message || owner: ${
          message.owner
        }, typeof(owner): ${typeof message.owner}`
      );
      console.log(
        `message || spender: ${
          message.spender
        }, typeof(spender): ${typeof message.spender}`
      );
      console.log(
        `message || value: ${
          message.value
        }, typeof(value): ${typeof message.value}`
      );
      console.log(
        `message || nonce: ${
          message.nonce
        }, typeof(nonce): ${typeof message.nonce}`
      );
      console.log(
        `message || deadline: ${
          message.deadline
        }, typeof(deadline): ${typeof message.deadline}`
      );

      const signedMessage = await signer.signTypedData(domain, types, message);
      console.log("sign_ERC20TokenApprove_AirDropOfNFT: ", signedMessage);
      const signatureResult = ethers.Signature.from(signedMessage);
      console.log("v: ", signatureResult.v);
      console.log("r: ", signatureResult.r);
      console.log("s: ", signatureResult.s);
      return {
        v: signatureResult.v,
        r: signatureResult.r,
        s: signatureResult.s,
      };
    } catch (error) {
      console.error("Error signing permit:", error);
    }
    return { v: undefined, r: undefined, s: undefined };
  };

  const pushMemberForParamOfMerkleTree = () => {
    const valueOfParam0 = valueOfParam0_MerkleTree.current?.value;
    const valueOfParam1 = valueOfParam1_MerkleTree.current?.value;
    const valueOfParam2 = valueOfParam2_MerkleTree.current?.value;
    if (valueOfParam0 && valueOfParam1 && valueOfParam2) {
      const memberUnit = [valueOfParam0, valueOfParam1, valueOfParam2];
      valuesOfMerkleTree.push(memberUnit);
      console.log(`"memberUnit"@index${inputCounter}: ${memberUnit}`);
      console.log(`valuesOfMerkleTree: ${valuesOfMerkleTree}`);
      console.log(valuesOfMerkleTree);
      inputCounter++;
    }
  };

  const resetParametersOfMerkleTree = () => {
    if (valueOfParam0_MerkleTree.current)
      valueOfParam0_MerkleTree.current.value = "";
    if (valueOfParam1_MerkleTree.current)
      valueOfParam1_MerkleTree.current.value = "";
    if (valueOfParam2_MerkleTree.current)
      valueOfParam2_MerkleTree.current.value = "";
    if (typeOfParam0_MerkleTree.current)
      typeOfParam0_MerkleTree.current.value = "";
    if (typeOfParam1_MerkleTree.current)
      typeOfParam1_MerkleTree.current.value = "";
    if (typeOfParam2_MerkleTree.current)
      typeOfParam2_MerkleTree.current.value = "";
    valuesOfMerkleTree = [];
    inputCounter = 0;
    console.log(`All the parameters for building Merkle tree have been reset.`);
  };

  /**
   * @dev This function is used for building a Merkle tree.
   */
  const buildMerkleTree = async () => {
    const typeOfAccount: any = typeOfParam0_MerkleTree.current?.value;
    const typeOfTokenId: any = typeOfParam1_MerkleTree.current?.value;
    const typeOfPrice: any = typeOfParam2_MerkleTree.current?.value;
    const values = valuesOfMerkleTree;
    const leafEncoding = [typeOfAccount, typeOfTokenId, typeOfPrice];
    console.log(`values: ${values}`);
    console.log(`leafEncoding: ${leafEncoding}`);
    try {
      const response = await fetch("http://localhost:3001/save-merkle-tree", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values, leafEncoding }),
      });
      const responseData = await response.json();
      console.log("Merkle Root: ", responseData.MerkleRoot);
    } catch (error) {
      console.error("Failed to save Merkle tree data:", error);
    }
  };

  /**
   * @dev This function is used for generating a Merkle proof for `_queriedInfo` which is under the verification of membership.
   * This required that the merkle tree file has been saved by calling `buildMerkleTree`.
   */
  const getMerkleProofAndInfo = async () => {
    let counter = 0;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const queriedInfo = await signer.getAddress();
    console.log(`queriedInfo: ${queriedInfo}`);
    while (counter < 20 && queriedInfo) {
      try {
        const url = new URL("http://localhost:3001/merkle-proof");
        url.search = new URLSearchParams({ queriedInfo }).toString();
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data = await response.json();
        console.log("tokenId:", data.tokenId);
        console.log("Merkle Proof:", data.MerkleProof);
        console.log("price:", data.price);
        return {
          MerkleProof: data.MerkleProof,
          tokenId: data.tokenId,
          price: data.price,
        };
      } catch (error) {
        counter++;
        console.error("Failed to fetch Merkle proof:", error);
      }
    }
    if (counter >= 20) {
      console.log("Failed to fetch data after several attempts");
    }
    return { MerkleProof: undefined, tokenId: undefined };
  };

  const getWhitelistData = async () => {
    let counter = 0;
    while (counter < 20) {
      try {
        const url = new URL("http://localhost:3001/whitelist-data");
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data = await response.json();
        console.log(`data.whitelistData: ${data.whitelistData}`);
        return data.whitelistData;
      } catch (error) {
        counter++;
        console.error("Failed to fetch whitelist data:", error);
      }
    }
    if (counter >= 20) {
      console.log("Failed to fetch data after several attempts");
    }
  };

  // This function can only be successfully called by the owner of the NFT contract.
  const generateWhitelistData = async () => {
    const NFTAddr = NFTAddr_WhitelistData.current?.value;
    const MerkleRoot = MerkleRoot_WhitelistData.current?.value;
    const NFTAbi = [
      "function launchSpecialOfferWithUniformPrice(bytes32) external view returns (bytes memory)",
    ];

    try {
      const response = await fetch(
        "http://localhost:3001/generate-whitelist-data",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            NFTAddr,
            MerkleRoot,
            NFTAbi,
            network_RPC_URL,
          }),
        }
      );
      const responseData = await response.json();
      console.log(responseData.message, responseData.whitelistData);
    } catch (error) {
      console.error(
        "Failed to send parameters to generate whitelist data:",
        error
      );
    }
  };

  const claimNFT = async () => {
    const NFTMarketAddr = NFTMarketAddr_ClaimNFT.current?.value;
    const whitelistData = await getWhitelistData();
    const { MerkleProof, tokenId, price } = await getMerkleProofAndInfo();
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    console.log("Signer Address: ", signer.getAddress());
    const abi_claimNFT = [
      "function claimNFT(uint256, bytes32[] calldata, uint256, bytes calldata) external",
    ];
    if (NFTMarketAddr) {
      const NFTMarketContract = new ethers.Contract(
        NFTMarketAddr,
        abi_claimNFT,
        signer
      );
      NFTMarketContract.claimNFT(tokenId, MerkleProof, price, whitelistData);
    }
  };

  const claimNFT_MultiCall = async () => {
    const NFTMarketAddr = spender_AirDropOfNFT_MultiCall.current?.value;
    const deadline = Date.now() + 900000;
    const whitelistData = await getWhitelistData();
    const { MerkleProof, tokenId, price } = await getMerkleProofAndInfo();
    // Start to sign message:
    const name = name_AirDropOfNFT_MultiCall.current?.value;
    const version = "1";
    const chainId = chainId_AirDropOfNFT_MultiCall.current?.value;
    const verifyingContract =
      verifyingContract_AirDropOfNFT_MultiCall.current?.value;
    const spender = NFTMarketAddr;
    const value = tokenAmount_AirDropOfNFT_MultiCall.current?.value;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const owner = await signer.getAddress();
    const tokenAddress = verifyingContract;
    const tokenAbi = ["function nonces(address owner) view returns (uint256)"];
    let ERC721WithPermitContract;
    let nonce;
    let v;
    let r;
    let s;
    if (tokenAddress) {
      ERC721WithPermitContract = new ethers.Contract(
        tokenAddress,
        tokenAbi,
        provider
      );
      nonce = await ERC721WithPermitContract.nonces(owner);
    } else {
      console.log("Invalid token address");
    }

    const domain = {
      name: name,
      version: version,
      chainId: chainId,
      verifyingContract: verifyingContract,
    };

    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const message = {
      owner: owner,
      spender: spender,
      value: value,
      nonce: nonce,
      deadline: deadline,
    };

    try {
      const signedMessage = await signer.signTypedData(domain, types, message);
      console.log("sign_ERC20TokenApprove_AirDropOfNFT: ", signedMessage);
      const signatureResult = ethers.Signature.from(signedMessage);
      v = signatureResult.v;
      r = signatureResult.r;
      s = signatureResult.s;
      console.log("v: ", signatureResult.v);
      console.log("r: ", signatureResult.r);
      console.log("s: ", signatureResult.s);
    } catch (error) {
      console.error("Error signing permit:", error);
    }
    // End

    const ABI_aggregate = [
      "function aggregate(tuple(address target, bytes callData)[] calls) returns (bytes[])",
    ];
    const ABI_permitPrePay = [
      "function permitPrePay(address, uint256, uint256, uint8, bytes32, bytes32) returns (bool)",
    ];
    const interface_permitPrePay = new ethers.Interface(ABI_permitPrePay);
    const callData_permitPrePay = interface_permitPrePay.encodeFunctionData(
      "permitPrePay",
      [owner, price, deadline, v, r, s]
    );
    const call_permitPrePay = {
      target: NFTMarketAddr,
      callData: callData_permitPrePay,
    };

    const ABI_claimNFT = [
      "function claimNFT(address, uint256, bytes32[], uint256, bytes)",
    ];
    const interface_claimNFT = new ethers.Interface(ABI_claimNFT);
    const callData_claimNFT = interface_claimNFT.encodeFunctionData(
      "claimNFT",
      [owner, tokenId, MerkleProof, price, whitelistData]
    );
    const call_claimNFT = {
      target: NFTMarketAddr,
      callData: callData_claimNFT,
    };

    const calls = [call_permitPrePay, call_claimNFT];
    console.log("calls: ", calls);

    if (NFTMarketAddr) {
      const NFTMarketContract = new ethers.Contract(
        NFTMarketAddr,
        ABI_aggregate,
        signer
      );
      try {
        await NFTMarketContract.aggregate(calls);
      } catch (error) {
        console.error("Error calling contract:", error);
      }
    }
  };

  // Create Inscription
  const deployInscription_ERC20TokenFactory = async () => {
    const name = name_DeployInscription.current?.value;
    const symbol = symbol_DeployInscription.current?.value;
    const totalSupply = totalSupply_DeployInscription.current?.value;
    const perMint = perMint_DeployInscription.current?.value;
    const mintFeeInETH = mintFeeInETH_DeployInscription.current?.value;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    let inscriptFactoryContract;
    if (inscriptFactoryAddr) {
      inscriptFactoryContract = new ethers.Contract(inscriptFactoryAddr, ERC20TokenFactoryABI, signer);
    } else {
      console.log("Invalid address of inscription factory");
    }
    try {
      if (inscriptFactoryContract)
      await inscriptFactoryContract.deployInscription(name, symbol, totalSupply, perMint, mintFeeInETH);
    } catch (error) {
      console.error("Error when deployInscription:", error);
    }
  };

  // Mint Inscription
  const mintInscription_ERC20TokenFactory = async () => {
    const inscriptAddress = inscriptAddr_MintInscription.current?.value;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    let inscriptFactoryContract;
    if (inscriptAddress && inscriptFactoryAddr) {
      inscriptFactoryContract = new ethers.Contract(inscriptFactoryAddr, ERC20TokenFactoryABI, signer);
      try {
        const tx = await inscriptFactoryContract.mintInscription(inscriptAddress, {value: 10**15});
        const receipt = await tx.wait();
        _updateStateAfterTx(receipt);
        if (receipt) {
          setListedInscription((prevListedInscription) => {
            const updatedList = { ...prevListedInscription };
            if (!updatedList[inscriptFactoryAddr]) {
              updatedList[inscriptFactoryAddr] = [];
            }
            updatedList[inscriptFactoryAddr].push(inscriptAddress);
            return updatedList;
          });
        }
        setError(false);
      } catch (error) {
        console.error("Error when deployInscription:", error);
      }
    } else {
      console.log("Invalid address of inscription factory");
    }
  };

  function printLog(msg: any) {
    let p = document.createElement("p");
    p.textContent = msg;
    document.getElementsByClassName("logs")[0].appendChild(p);
  }

  // function printLog_Inscription(msg: any) {
  //   let p = document.createElement("p");
  //   p.textContent = msg;
  //   document.getElementsByClassName("logs_Inscription")[0].appendChild(p);
  // }


  const openTxUrl_List = () => {
    if (TxURL_List) window.open(TxURL_List, "_blank");
  };
  const openTxUrl_Deist = () => {
    if (TxURL_Delist) window.open(TxURL_Delist, "_blank");
  };
  const openTxUrl_Buy = () => {
    if (TxURL_Buy) window.open(TxURL_Buy, "_blank");
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const accounts: [] = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      let startBlockNumber = 45068820;
      getLogs(startBlockNumber, startBlockNumber + 200);
      _updateState(accounts);
      setError(false);
    } catch (err: any) {
      setError(true);
      setErrorMessage(err.message);
    }
    setIsConnecting(false);
  };

  return (
    <div className="App">
      <h2>Garen NFTMarket</h2>
      <div>
        {window.ethereum?.isMetaMask && wallet.accounts.length < 1 && (
          <button
            disabled={disableConnect}
            style={{ fontSize: "22px" }}
            onClick={handleConnect}
          >
            Connect MetaMask
          </button>
        )}
      </div>
      <div className="info-container">
        {wallet.accounts.length > 0 && (
          <>
            <div>Wallet Accounts: {wallet.accounts[0]}</div>
            <div>Wallet Balance: {wallet.balance}</div>
            <div>ChainId: {wallet.chainId}</div>
            <div>Token(GTT) Balance: {GTTBalance} GTT</div>
          </>
        )}
        {error && (
          <div
            style={{ fontSize: "18px", color: "red" }}
            onClick={() => setError(false)}
          >
            <strong>Error:</strong> {errorMessage}
          </div>
        )}
      </div>
      <div className="InteractionArea">
        {wallet.accounts.length > 0 && (
          <div className="left-container">

            {/*
            <h3 style={{ fontSize: "20px" }}>
              Obtain Formatted Parameters for buildMerkleTree:{" "}
            </h3>
            {window.ethereum?.isMetaMask && wallet.accounts.length > 0 && (
              <>
                <label>Value of Param #0:</label>
                <input
                  ref={valueOfParam0_MerkleTree}
                  placeholder="value of param #0"
                  type="text"
                />
                <label>Value of Param #1:</label>
                <input
                  ref={valueOfParam1_MerkleTree}
                  placeholder="value of param #1"
                  type="text"
                />
                <label>Value of Param #2:</label>
                <input
                  ref={valueOfParam2_MerkleTree}
                  placeholder="value of param #2"
                  type="text"
                />
                <label>Type of Param #0:</label>
                <input
                  ref={typeOfParam0_MerkleTree}
                  placeholder="Type of Param #0"
                  type="text"
                />
                <label>Type of Param #1:</label>
                <input
                  ref={typeOfParam1_MerkleTree}
                  placeholder="Type of Param #1"
                  type="text"
                />
                <label>Type of Param #2:</label>
                <input
                  ref={typeOfParam2_MerkleTree}
                  placeholder="Type of Param #2"
                  type="text"
                />
                <button onClick={pushMemberForParamOfMerkleTree}>
                  Push Member Into Array
                </button>
                <button onClick={buildMerkleTree}>
                  Finish pushing members & build Merkle Tree!
                </button>
                <button onClick={resetParametersOfMerkleTree}>
                  Reset Parameters
                </button>
              </>
            )}
            <br />
            <h3 style={{ fontSize: "20px" }}>
              Generate Whitelist Data of NFT(Only For Project Party):{" "}
            </h3>
            {window.ethereum?.isMetaMask && wallet.accounts.length > 0 && (
              <>
                <label>NFT Address:</label>
                <input
                  ref={NFTAddr_WhitelistData}
                  placeholder="NFT Address"
                  type="text"
                />
                <label>Merkle Root:</label>
                <input
                  ref={MerkleRoot_WhitelistData}
                  placeholder="Merkle Tree"
                  type="text"
                />
                <button onClick={generateWhitelistData}>
                  Generate Whitelist Data
                </button>
              </>
            )}
            <br />
            <h3 style={{ fontSize: "20px" }}>
              Sign for Approving NFTMarket to get Airdrop:{" "}
            </h3>
            {window.ethereum?.isMetaMask && wallet.accounts.length > 0 && (
              <>
                <label>Token Name:</label>
                <input
                  ref={name_AirDropOfNFT}
                  placeholder="Token Name"
                  type="text"
                />
                <label>ChainId:</label>
                <input
                  ref={chainId_AirDropOfNFT}
                  placeholder="ChainId"
                  type="text"
                />
                <label>Verifying Contract Address:</label>
                <input
                  ref={verifyingContract_AirDropOfNFT}
                  placeholder="Verifying Contract Address"
                  type="text"
                />
                <label>Spender:</label>
                <input
                  ref={spender_AirDropOfNFT}
                  placeholder="Spender"
                  type="text"
                />
                <label>Token Amount:</label>
                <input
                  ref={tokenAmount_AirDropOfNFT}
                  placeholder="Token Amount"
                  type="text"
                />
                <label>Deadline:</label>
                <input
                  ref={deadline_AirDropOfNFT}
                  placeholder="Deadline"
                  type="text"
                />
                <button onClick={sign_ERC20Permit_AirdropOfNFT}>
                  Sign ERC20 Token Permit
                </button>
              </>
            )}
            <br />
            <h3 style={{ fontSize: "20px" }}>
              Claim NFT for Current Account:{" "}
            </h3>
            {window.ethereum?.isMetaMask && wallet.accounts.length > 0 && (
              <>
                <label>NFTMarket Address:</label>
                <input
                  ref={NFTMarketAddr_ClaimNFT}
                  placeholder="NFTMarket Address"
                  type="text"
                />
                <button onClick={claimNFT}>Claim NFT!</button>
              </>
            )}
            <br />
            <h3 style={{ fontSize: "20px" }}>Claim NFT By MultiCall: </h3>
            {window.ethereum?.isMetaMask && wallet.accounts.length > 0 && (
              <>
                <label>ERC20 Token Name:</label>
                <input
                  ref={name_AirDropOfNFT_MultiCall}
                  placeholder="Token Name"
                  type="text"
                />
                <label>ChainId:</label>
                <input
                  ref={chainId_AirDropOfNFT_MultiCall}
                  placeholder="ChainId"
                  type="text"
                />
                <label>Verifying Contract Address:</label>
                <input
                  ref={verifyingContract_AirDropOfNFT_MultiCall}
                  placeholder="Verifying Contract Address"
                  type="text"
                />
                <label>NFT Market Address:</label>
                <input
                  ref={spender_AirDropOfNFT_MultiCall}
                  placeholder="Spender"
                  type="text"
                />
                <label>NFT Price(Amount of ERC20 Token):</label>
                <input
                  ref={tokenAmount_AirDropOfNFT_MultiCall}
                  placeholder="Token Amount"
                  type="text"
                />
                <button onClick={claimNFT_MultiCall}>
                  Claim NFT!(MultiCall)
                </button>
              </>
            )} 
            */}

            <h3 style={{ fontSize: "20px" }}>
              Create Inscription:{" "}
            </h3>
            {window.ethereum?.isMetaMask && wallet.accounts.length > 0 && (
              <>
                <label>Inscription Name:</label>
                <input
                  ref={name_DeployInscription}
                  placeholder="Inscription Name"
                  type="text"
                />
                <label>Inscription Symbol:</label>
                <input
                  ref={symbol_DeployInscription}
                  placeholder="Inscription Symbol"
                  type="text"
                />
                <label>Max Supply:</label>
                <input
                  ref={totalSupply_DeployInscription}
                  placeholder="Max Supply"
                  type="text"
                />
                <label>Amount Per Mint:</label>
                <input
                  ref={perMint_DeployInscription}
                  placeholder="Amount Per Mint"
                  type="text"
                />
                <label>Mint Fee(uint: wei):</label>
                <input
                  ref={mintFeeInETH_DeployInscription}
                  placeholder="Fee in ETH for Minting"
                  type="text"
                />
                <button onClick={deployInscription_ERC20TokenFactory}>
                  Create Inscription
                </button>
              </>
            )}
            <br />
            <h3 style={{ fontSize: "20px" }}>
              Mint Inscription:{" "}
            </h3>
            {window.ethereum?.isMetaMask && wallet.accounts.length > 0 && (
              <>
                <label>Inscription Address:</label>
                <input
                  ref={inscriptAddr_MintInscription}
                  placeholder="Inscription Address"
                  type="text"
                />
                <button onClick={mintInscription_ERC20TokenFactory}>
                  Mint Inscription
                </button>
              </>
            )}
            <br />
          </div>
        )}
        {wallet.accounts.length > 0 && (
          <div className="right-container">
            
            {/*
            <h3>Listed NFTs: </h3>
            {Object.keys(ListedNFT).map((address) => (
              <div key={address}>
                <h4>{address}</h4>
                <ul>
                  {ListedNFT[address].map((tokenId) => (
                    <li key={tokenId}>Token ID: {tokenId}</li>
                  ))}
                </ul>
              </div>
            ))}
            <h4
              style={{ fontSize: "20px", color: "gray", marginBottom: "3px" }}
            >
              Logs :{" "}
            </h4>
            {wallet.accounts.length > 0 && (
              <div
                className="logs"
                style={{ fontSize: "15px", color: "gray" }}
              ></div>
            )}
            */}

            <h3>Created Inscription: </h3>
            {Object.keys(ListedInscription).map((inscriptFactory) => (
              <div key={inscriptFactory}>
                <h4>Inscription Factory: {inscriptFactory}</h4>
                <ul>
                  {ListedInscription[inscriptFactory].map((inscript) => (
                    <li key={inscript}>Inscription Address: {inscript}</li>
                  ))}
                </ul>
              </div>
            ))}

          </div>
        )}
      </div>
    </div>
  );
};

export default App;