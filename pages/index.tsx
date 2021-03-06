import type { NextPage } from "next";
import { useEffect, useState } from "react";
import styles from "../styles/Home.module.css";
import Web3 from "web3";
import { ethers, providers } from "ethers";
import {
  Container,
  Box,
  Grid,
  Stack,
  Card,
  Divider,
  Paper,
  CardContent,
  CardActions,
  Avatar,
  Typography,
  FormControl,
  Select,
  MenuItem,
  TextField,
  Button,
  Modal,
} from "@mui/material";
import RenJS from "@renproject/ren";
import { Terra } from "@renproject/chains";
import { Bitcoin } from "@renproject/chains-bitcoin";
import { Ethereum } from "@renproject/chains-ethereum";
import { Chain, RenNetwork } from "@renproject/utils";
import Identicon from "react-identicons";
import { FaEthereum, FaBitcoin } from "react-icons/fa";
import FLIP_JSON from "./Flip.json";

interface Balance {
  btc: number;
  luna: number;
}
interface Game {
  initiator: string;
  amount: number;
  symbol: string;
}

enum COIN {
  ETH = "ETH",
  BTC = "BTC",
  LUNA = "LUNA",
}

const contractAddress = "0x698D11acAbB319e9FC9b1c9fA0768cED2B08d998";
const network = RenNetwork.Testnet;
const bitcoin = new Bitcoin({ network });
const ethereum = new Ethereum({
  network,
  provider: new providers.JsonRpcProvider(
    (Ethereum.configMap[network] as any).network.rpcUrls[0]
  ),
});
// const provider: any = await detectEthereumProvider();

const renJS = new RenJS(network).withChains(bitcoin, ethereum);

const Home: NextPage = () => {
  const modalStyle = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 400,
    bgcolor: "#FAFAFA",
    border: "2px solid #000",
    boxShadow: 24,
    p: 4,
  };

  let [web3, setWeb3] = useState<any>();
  let [contract, setContract] = useState<any>();
  let [address, setAddress] = useState("");
  let [recipientAddress, setRecipientAddress] = useState("");
  let [gatewayAddress, setGatewayAddress] = useState("");
  let [userbalance, setUserBalance] = useState({
    ETH: 0,
    BTC: 0,
    LUNA: 0,
  });
  let [contractBalance, setContractBalance] = useState({
    ETH: 0,
    BTC: 0,
    LUNA: 0,
  });
  let [amount, setAmount] = useState("");
  let [games, setGames] = useState<Game[]>([]);

  let [createGameModalIsOpened, setCreateGameModalIsOpened] = useState(false);
  let [depositModalIsOpened, setDepositModalIsOpened] = useState(false);
  let [withdrawModalIsOpened, setWithdrawModalIsOpened] = useState(false);
  let [selectedCoin, setSelectedCoin] = useState(COIN.ETH);

  useEffect(() => {
    ethereum.withSigner(
      new ethers.providers.Web3Provider(
        (window as any).ethereum,
        "any"
      ).getSigner()
    );
    let web3 = new Web3((window as any).ethereum || "http://127.0.0.1:8545");
    setWeb3(web3);
    const contract = new web3.eth.Contract(
      (FLIP_JSON as any).abi,
      contractAddress
    );
    setContract(contract);
    contract.once("Deposit", (error, event) => {
      console.log(event);
    });
  }, []);

  useEffect(() => {
    getAddress();
    getContractBalance();
    getGames();
    if (web3 && contract) {
      contract.methods
        .getBtcBalance()
        .call()
        .then((balance: Balance) => {
          console.log("Contract BTC Balance: ", balance);
        });
    }

  }, [web3, contract]);

  useEffect(() => {
    getUserBalance();
  }, [address]);

  const getAddress = () => {
    if (web3) {
      web3.eth.getAccounts().then((accounts: any) => {
        setAddress(accounts[0]);
      });
    }
  };

  const getContractBalance = () => {
    if (web3 && contract) {
      web3.eth.getBalance(contractAddress).then((balance: any) => {
        setContractBalance((prevState) => ({
          ...prevState,
          ETH: Number(web3.utils.fromWei(balance, "ether")),
        }));
      });
      contract.methods
        .getTotalBalance()
        .call()
        .then((balance: Balance) => {
          console.log("Contract Balance: ", balance);
          setContractBalance((prevState) => ({
            ...prevState,
            BTC: balance.btc,
            LUNA: balance.luna,
          }));
        });
    }
  };

  const getUserBalance = () => {
    if (address) {
      web3.eth.getBalance(address).then((balance: Balance) => {
        console.log("User Balance(ETH): ", balance);
        setUserBalance((prevState) => ({
          ...prevState,
          ETH: Number(web3.utils.fromWei(balance, "ether")),
        }));
      });
      contract.methods
        .getBalance(address)
        .call()
        .then((balance: Balance) => {
          console.log("User Balance: ", balance);
          setUserBalance((prevState) => ({
            ...prevState,
            BTC: balance.btc,
            LUNA: balance.luna,
          }));
        });
    }
  };

  const getGames = () => {
    if (contract) {
      contract.methods
        .getGames()
        .call()
        .then((games: Game[]) => {
          console.log("Games: ", games);
          setGames(games);
        });
    }
  };

  const deposit = async (symbol: COIN) => {
    if (symbol === COIN.ETH) {
      return false;
    }
    const gateway = await renJS.gateway({
      asset: symbol,
      from:
        symbol === COIN.BTC ? bitcoin.GatewayAddress() : new Terra({ network }),
      to: ethereum.Contract({
        to: contractAddress,
        method: symbol === COIN.BTC ? "depositBTC" : "depositLUNA",
        withRenParams: true,
        params: [
          {
            name: "_address",
            type: "address",
            value: address,
          },
        ],
      }),
    });
    console.log(gateway);
    if (gateway.gatewayAddress) {
      setGatewayAddress(gateway.gatewayAddress);
    }

    console.log("gateway fee: ", gateway.fees);
    // await gateway.inSetup.approval.submit({
    //   txConfig: {
    //     gasLimit: 1000000,
    //   },
    // });
    // await gateway.inSetup.approval.wait();
    // await gateway.in.submit().on("progress", console.log);
    // await gateway.in.wait(1);

    gateway.on("transaction", (tx) => {
      (async () => {
        // GatewayTransaction parameters are serializable. To re-create
        // the transaction, call `renJS.gatewayTransaction`.
        console.log(tx);

        // Wait for remaining confirmations for input transaction.
        await tx.in.wait();

        // RenVM transaction also follows the submit/wait pattern.
        await tx.renVM.submit().on("progress", console.log);
        await tx.renVM.wait();

        // `submit` accepts a `txConfig` parameter for overriding
        // transaction config.
        if (tx.out.submit) {
          await tx.out.submit({
            txConfig: {},
          });
        }
        await tx.out.wait();

        // All transactions return a `ChainTransaction` object in the
        // progress field, with a `txid` field (base64) and a
        // `txidFormatted` field (chain-dependent).
        const outTx = tx.out.progress.transaction;
        console.log("Done:", outTx.txidFormatted);

        // All chain classes expose a common set of helper functions (see
        // `Chain` class.)
        console.log(tx.toChain.transactionExplorerLink(outTx));
      })().catch(console.error);
    });
  };

  const withdraw = async (
    symbol: COIN,
    recipientAddress: string,
    amount: string
  ) => {
    const _amount = web3.eth.abi.encodeParameter("uint256", amount);
    const gateway = await renJS.gateway({
      asset: symbol,
      from: ethereum.Contract({
        to: contractAddress,
        method: "withdraw",
        withRenParams: false,
        params: [
          {
            type: "string",
            name: "_symbol",
            value: symbol,
          },
          {
            name: "_address",
            type: "address",
            value: address,
          },
          {
            type: "bytes",
            name: "_to",
            value: Buffer.from(recipientAddress),
          },
          {
            type: "uint256",
            name: "_amount",
            value: _amount,
          },
        ],
      }),
      to: bitcoin.Address(recipientAddress),
    });
    console.log(gateway);

    await gateway.in.submit({
      txConfig: {
        gasLimit: 1000000,
      },
    });
    await gateway.in.wait(1);

    gateway.on("transaction", (tx) => {
      (async () => {
        console.log(tx);
        await tx.in.wait();
        await tx.renVM.submit().on("progress", console.log);
        await tx.renVM.wait();
        if (tx.out.submit) {
          await tx.out.submit({
            txConfig: {},
          });
        }
        await tx.out.wait();
        const outTx = tx.out.progress.transaction;
        console.log("Done:", outTx.txidFormatted);
        console.log(tx.toChain.transactionExplorerLink(outTx));
      })().catch(console.error);
    });
  };

  const openGame = async (symbol: COIN, amount: string) => {
    if (symbol === COIN.ETH) {
      contract.methods
        .openGame(symbol, web3.utils.toWei(amount, "ether"))
        .send({ from: address, value: web3.utils.toWei(amount, "ether") })
        .then(() => {
          update();
        });
    }
    if (symbol === COIN.BTC) {
      contract.methods
        .openGame(symbol, web3.eth.abi.encodeParameter("uint256", amount))
        .send({ from: address })
        .then(() => {
          update();
        });
    }

    setCreateGameModalIsOpened(false);
  };

  const acceptGame = (id: number, amount: number) => {
    if (games[id].symbol === COIN.ETH) {
      contract.methods
        .acceptGame(id)
        .send({ from: address, value: amount })
        .then(() => {
          update();
        });
    } else {
      contract.methods
        .acceptGame(id)
        .call()
        .then(() => {
          update();
        });
    }
    contract.once("Result", (error, event) => {
      console.log(event);
    });
  };

  const update = () => {
    getGames();
    getContractBalance();
    getAddress();
    getUserBalance();
  };

  const handleCloseCreateGameModal = () => {
    setAmount("");
    setSelectedCoin(COIN.ETH);
    setGatewayAddress("");
    setCreateGameModalIsOpened(false);
  };

  const handleCloseDepositModal = () => {
    setAmount("");
    setSelectedCoin(COIN.ETH);
    setGatewayAddress("");
    setDepositModalIsOpened(false);
  };

  const handleCloseWithdrawModal = () => {
    setAmount("");
    setSelectedCoin(COIN.ETH);
    setRecipientAddress("");
    setWithdrawModalIsOpened(false);
  };

  const handleCoinSelectChange = (e: any) => {
    setSelectedCoin(e.target.value);
  };
  return (
    <div className={styles.container}>
      <Container maxWidth="xl">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems="start"
          divider={<Divider orientation="vertical" flexItem />}
          spacing={5}
          mt={3}
        >
          <Typography variant="h2">COIN FLIP</Typography>
          <Stack>
            <Typography variant="h5">Contract Balance</Typography>
            <Stack sx={{ mt: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="h4" sx={{ color: "#009688" }}>
                  <FaEthereum />
                </Typography>
                <Typography variant="h4" sx={{ color: "#009688" }}>
                  {contractBalance.ETH}
                </Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="h4" sx={{ color: "#009688" }}>
                  <FaBitcoin />
                </Typography>
                <Typography variant="h4" sx={{ color: "#009688" }}>
                  {contractBalance.BTC / 10 ** 8}
                </Typography>
              </Stack>
            </Stack>
            {/* {Number(contractBalance.LUNA)} LUNA */}
          </Stack>
          <Stack>
            <Typography variant="h6">Opened Games</Typography>
            <Typography variant="h4" sx={{ color: "#009688", mt: 2 }}>
              {games.length}
            </Typography>
          </Stack>
        </Stack>
        <Paper
          sx={{
            bgcolor: "#009688",
            p: 3,
            mt: 3,
            color: "#FAFAFA",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={3}>
            <Avatar
              sx={{
                width: 60,
                height: 60,
                background: "#FAFAFA",
              }}
            >
              <Identicon string={address} size={50} />
            </Avatar>
            <Stack>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="h4">
                  <FaEthereum />
                </Typography>
                <Typography variant="h4">{userbalance.ETH}</Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="h4">
                  <FaBitcoin />
                </Typography>
                <Typography variant="h4">
                  {userbalance.BTC / 10 ** 8}
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        </Paper>
        <Stack direction="row" spacing={2} mt={3}>
          <Button
            variant="outlined"
            onClick={() => setCreateGameModalIsOpened(true)}
          >
            Flip a Coin
          </Button>
          <Button variant="outlined" onClick={update}>
            Refresh
          </Button>
          <Button
            variant="outlined"
            onClick={() => setDepositModalIsOpened(true)}
          >
            Deposit
          </Button>
          <Button
            variant="outlined"
            onClick={() => setWithdrawModalIsOpened(true)}
          >
            Withdraw
          </Button>
        </Stack>

        <Modal
          open={depositModalIsOpened}
          onClose={handleCloseDepositModal}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={modalStyle}>
            <Stack spacing={5}>
              <Stack spacing={2} direction="row">
                <TextField
                  autoFocus
                  label={`Amount (${selectedCoin})`}
                  variant="standard"
                  value={amount}
                  type="number"
                  onChange={(e) => setAmount(e.target.value)}
                />
                <FormControl>
                  <Select
                    value={selectedCoin}
                    onChange={handleCoinSelectChange}
                  >
                    <MenuItem value={COIN.BTC}>BTC</MenuItem>
                    <MenuItem value={COIN.LUNA}>LUNA</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <Typography variant="body1">
                Gateway Address: {gatewayAddress}
              </Typography>
              <Stack spacing={2} direction="row">
                <Button
                  variant="contained"
                  onClick={() => deposit(selectedCoin)}
                >
                  Deposit
                </Button>
                <Button
                  variant="contained"
                  onClick={handleCloseDepositModal}
                  color="error"
                >
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Modal>

        <Modal
          open={withdrawModalIsOpened}
          onClose={handleCloseWithdrawModal}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={modalStyle}>
            <Stack spacing={5}>
              <Stack spacing={2} direction="row">
                <TextField
                  autoFocus
                  label={`Amount (${selectedCoin})`}
                  variant="standard"
                  value={amount}
                  type="number"
                  onChange={(e) => setAmount(e.target.value)}
                />
                <FormControl>
                  <Select
                    value={selectedCoin}
                    onChange={handleCoinSelectChange}
                  >
                    <MenuItem value={COIN.BTC}>BTC</MenuItem>
                    <MenuItem value={COIN.LUNA}>LUNA</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <TextField
                autoFocus
                label="Recipient address"
                variant="standard"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
              />
              <Stack spacing={2} direction="row">
                <Button
                  variant="contained"
                  onClick={() =>
                    withdraw(selectedCoin, recipientAddress, amount)
                  }
                >
                  Withdraw
                </Button>
                <Button
                  variant="contained"
                  onClick={handleCloseWithdrawModal}
                  color="error"
                >
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Modal>

        <Modal
          open={createGameModalIsOpened}
          onClose={handleCloseCreateGameModal}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={modalStyle}>
            <Stack spacing={5}>
              <Stack spacing={2} direction="row">
                <TextField
                  autoFocus
                  label={`Amount (${selectedCoin})`}
                  variant="standard"
                  value={amount}
                  type="number"
                  onChange={(e) => setAmount(e.target.value)}
                />
                <FormControl>
                  <Select
                    value={selectedCoin}
                    onChange={handleCoinSelectChange}
                  >
                    <MenuItem value={COIN.ETH}>ETH</MenuItem>
                    <MenuItem value={COIN.BTC}>BTC</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <Stack spacing={2} direction="row">
                <Button
                  variant="contained"
                  onClick={() => openGame(selectedCoin, amount)}
                >
                  Bet
                </Button>
                <Button
                  variant="contained"
                  onClick={handleCloseCreateGameModal}
                  color="error"
                >
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Modal>

        <Grid container spacing={2} mt={2}>
          {games.map((game, i) => (
            <Grid item key={i} xs={12} sm={6} md={4} lg={3}>
              <Card>
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        background: "#FAFAFA",
                      }}
                    >
                      <Identicon string={game.initiator} size={30} />
                    </Avatar>
                    <Typography variant="body2">
                      {game.initiator !== address
                        ? game.initiator.replace(
                          game.initiator.substring(5, 38),
                          "..."
                        )
                        : "Created By You"}
                    </Typography>
                  </Stack>
                  <Typography variant="h4" sx={{ textAlign: "center", mt: 5 }}>
                    {game.symbol === COIN.ETH &&
                      Number(
                        web3.utils.fromWei(game.amount.toString(), "ether")
                      )}
                    {game.symbol === COIN.BTC && Number(game.amount) / 10 ** 8}
                    {game.symbol}
                  </Typography>
                </CardContent>
                <CardActions>
                  {game.initiator !== address ? (
                    <Button
                      variant="text"
                      onClick={() => acceptGame(i, game.amount)}
                    >
                      Accept
                    </Button>
                  ) : (
                    <Button variant="text" disabled>
                      Waiting
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </div>
  );
};

export default Home;
