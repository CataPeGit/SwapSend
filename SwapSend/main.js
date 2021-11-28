/** Connect to Moralis server */
const serverUrl = " ---ADD SERVER URL---";
const appId = " ---ADD APP ID---";

let currentTrade = {};
let currentSelectSide;
let tokens;
let setTokenSymbol = [];

async function init() {
  await Moralis.start({ serverUrl, appId });
  await Moralis.enableWeb3();
  await listAvailableTokens();
  currentUser = Moralis.User.current();
  if (currentUser) {
    document.getElementById("swap_button").disabled = false;
    document.getElementById("send_button").disabled = false;
  }
}

async function listAvailableTokens() {
  const result = await Moralis.Plugins.oneInch.getSupportedTokens({
    chain: "eth", // The blockchain you want to use (eth/bsc/polygon)
  });
  tokens = result.tokens;
  let parent = document.getElementById("token_list");
  for (const address in tokens) {
    let token = tokens[address];
    let div = document.createElement("div");
    div.setAttribute("data-address", address);
    div.className = "token_row";
    let html = `
        <img class="token_list_img" src="${token.logoURI}">
        <span class="token_list_text">${token.symbol}</span>
        `;
    div.innerHTML = html;
    div.onclick = () => {
      selectToken(address);
    };
    parent.appendChild(div);
  }
}



function selectToken(address) {
  closeModal();
  console.log(tokens);
  currentTrade[currentSelectSide] = tokens[address];
  console.log(currentTrade);
  renderInterface();
  getQuote();
}

function renderInterface() {
  if (currentTrade.from) {
    document.getElementById("from_token_img").src = currentTrade.from.logoURI;
    document.getElementById("from_token_text").innerHTML = currentTrade.from.symbol;
    getQuote();
  }
  if (currentTrade.to) {
    document.getElementById("to_token_img").src = currentTrade.to.logoURI;
    document.getElementById("to_token_text").innerHTML = currentTrade.to.symbol;
    getQuote();
  }
  if( currentTrade.sendTokenSelectOpen ) {
    document.getElementById("send_token_img").src = currentTrade.sendTokenSelectOpen.logoURI;
    document.getElementById("send_token_text").innerHTML = currentTrade.sendTokenSelectOpen.symbol;
    setTokenSymbol.push(currentTrade.sendTokenSelectOpen.symbol);
  }
}

async function login() {
  try {
    currentUser = Moralis.User.current();
    if (!currentUser) {
      currentUser = await Moralis.authenticate();
    }
    document.getElementById("swap_button").disabled = false;
    document.getElementById("send_button").disabled = false;
  } catch (error) {
    console.log(error);
  }
}

function openModal(side) {
  currentSelectSide = side;
  document.getElementById("token_modal").style.display = "block";
}
function closeModal() {
  document.getElementById("token_modal").style.display = "none";
}

async function getQuote() {
  if (!currentTrade.from || !currentTrade.to || !document.getElementById("from_amount").value) return;

  let amount = Number(document.getElementById("from_amount").value * 10 ** currentTrade.from.decimals);

  const quote = await Moralis.Plugins.oneInch.quote({
    chain: "eth", // The blockchain you want to use (eth/bsc/polygon)
    fromTokenAddress: currentTrade.from.address, // The token you want to swap
    toTokenAddress: currentTrade.to.address, // The token you want to receive
    amount: amount,
  });
  console.log(quote);
  document.getElementById("gas_estimate").innerHTML = quote.estimatedGas;
  document.getElementById("to_amount").value = quote.toTokenAmount / 10 ** quote.toToken.decimals;
}

async function trySwap() {
  let address = Moralis.User.current().get("ethAddress");
  let amount = Number(document.getElementById("from_amount").value * 10 ** currentTrade.from.decimals);
  if (currentTrade.from.symbol !== "ETH") {
    const allowance = await Moralis.Plugins.oneInch.hasAllowance({
      chain: "eth", // The blockchain you want to use (eth/bsc/polygon)
      fromTokenAddress: currentTrade.from.address, // The token you want to swap
      fromAddress: address, // Your wallet address
      amount: amount,
    });
    console.log(allowance);
    if (!allowance) {
      await Moralis.Plugins.oneInch.approve({
        chain: "eth", // The blockchain you want to use (eth/bsc/polygon)
        tokenAddress: currentTrade.from.address, // The token you want to swap
        fromAddress: address, // Your wallet address
      });
    }
  }
  try {
    let receipt = await doSwap(address, amount);
    alert("Swap Complete");
  } catch (error) {
    console.log(error);
  }
}

function doSwap(userAddress, amount) {
  return Moralis.Plugins.oneInch.swap({
    chain: "eth", // The blockchain you want to use (eth/bsc/polygon)
    fromTokenAddress: currentTrade.from.address, // The token you want to swap
    toTokenAddress: currentTrade.to.address, // The token you want to receive
    amount: amount,
    fromAddress: userAddress, // Your wallet address
    slippage: 1,
  });
}


async function send() {

  let sendAmount = Number(document.getElementById("send_amount").value);
  symbol = setTokenSymbol[setTokenSymbol.length-1]
  const recieverAcc = document.getElementById("reciever_address").value;

  //Get metadata selected token
  const myToken = { chain: "eth", symbols: `${symbol}` };
  const myTokenData = await Moralis.Web3API.token.getTokenMetadataBySymbol(myToken);

  //Get metadata for an array of tokens
  const data = { chain: "eth", symbols: `${symbol}` };  
  const tokenMetadata = await Moralis.Web3API.token.getTokenMetadataBySymbol(data);

  rez = tokenMetadata.address
  console.log(myTokenData);

  if (symbol == "ETH"){
    // sending 0.5 ETH
  const ethersend = {type: "native", amount: Moralis.Units.ETH(`${sendAmount}`), receiver: recieverAcc}
  await Moralis.transfer(ethersend)
  }
  else {
  // sending tokens with 18 decimals
  const sending = {type: "erc20", 
                  amount: Moralis.Units.ETH( `${sendAmount}`, `${myTokenData.decimals}`), 
                  receiver: recieverAcc,
                  contractAddress: `${myTokenData[0].address}`
                }

  //console.log(sendAmount);
  //console.log(symbol);

  await Moralis.transfer(sending)
  }
  alert("Send Complete");
    

}


init();

document.getElementById("send_button").onclick = send;

document.getElementById("modal_close").onclick = closeModal;
document.getElementById("from_token_select").onclick = () => {
  openModal("from");
};
document.getElementById("to_token_select").onclick = () => {
  openModal("to");
};
document.getElementById("login_button").onclick = login;
document.getElementById("from_amount").onblur = getQuote;
document.getElementById("swap_button").onclick = trySwap;



document.getElementById("send_token_select").onclick = () => {
  openModal("sendTokenSelectOpen")
};


setInterval(getQuote, 1000)

setInterval(() => {
  getQuote();
}, 1000);

