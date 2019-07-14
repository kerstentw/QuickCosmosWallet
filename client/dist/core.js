
// Globals

var state = {
  protocol: "Cosmos",
  default_section: "home_section",
  current_section: "home_section",
  default_provider: "https://stargate.cosmos.network",
  current_provider: "",
  providers: ["https://stargate.cosmos.network", "https://avocadoterminal.com/litenode"],
  sections: ["home_section",
             "wallet_view_section",
             "wallet_section",
             "tx_create_section",
             "tx_sign_broadcast_section"]
}

EPS = {
  balance_of: "/bank/balances/",
  delegations: "/staking/delegators/",
  auth_accounts: "/auth/accounts/"

}

function balanceResponseParse(_response_obj){
  if (_response_obj.length == 0){
    return [
      {
        denom: "uatom",
        amount: 0
      }
    ]
  } else {
    return _response_obj
  }
}

function buildWalletInfoView(_info_obj){
    let balances = _info_obj.balances;
    let delegations = _info_obj.delegations;

    let balance_card = ""
    let delegation_card = ""

    for (let i = 0; i < balances.length; i++){
      let denom = balances[i].denom;
      let amount = balances[i].amount;
      balance_card += `<div class='card'><div class='card-body'>${amount} ${denom}</div></div>`
    }

    for (let i = 0; i < delegations.length; i++){
      let delegator_address = delegations[i].delegator_address || 0;
      let validator_address = delegations[i].validator_address || 0;
      let shares = delegations[i].shares || 0;
      delegation_card += `<div class='card'>
                         <div class='card-body'>
                           <table>
                             <tr>
                               <td> <strong> Validator Address </strong></td>
                               <td> ${validator_address}</td>
                             </tr>
                             <tr>
                               <td> <strong> Delegated </strong></td>
                               <td> ${shares} </td>
                             </tr>
                           </table>
                         </div>
                       </div>`
    }

    let frame = `
      <div class = "row">
        <div class="col-md-6 card">
          <h1> Balance </h1>
          ${balance_card || 0}
        </div>
        <div class="col-md-6 card">
          <h1> Delegations </h1>
          ${delegation_card || 0}
        </div>
      </div>
    `

    return frame;


}

// Wallet Info Handlers

async function lookupBalance(_address_string){
  let resp = await $.ajax(`${state.current_provider}${EPS.balance_of}${_address_string}`,{
    method: "GET",
  });

  return balanceResponseParse(resp)

}

async function lookupAuthAccount(_address_string){
  let resp = await $.ajax(`${state.current_provider}${EPS.auth_accounts}${_address_string}`)
  return resp == null? {type: "unused",  value: 0, public_key: 0, sequence: 0, account_number: 0} : resp;
}

async function lookupDelegations(_address_string){
  let resp = await $.ajax(`${state.current_provider}${EPS.delegations}${_address_string}/delegations`)
  return resp == null? {shares: 0, delegator_address: 0, validator_address: 0} : resp;
}

async function getWalletInfo(_address_string){
  let wallet_info = new Object();

  wallet_info.balances = await lookupBalance(_address_string);
  wallet_info.delegations = await lookupDelegations(_address_string);

  //TODO: Determine if Validator

  return wallet_info;
}


// Entropy Tool

function generateEntropyFromMouse(){
  let entropy = "";
  let curr = 0;
  let LIM = 5000

  $(window).mousemove((ev) => {

    if (entropy.length > LIM) {
      $(window).off();
      $('.useEntropy').show();
      return
    }
    let salt = new Date().getTime()
    entropy += String(ev.clientX + ev.clientY + salt);
    console.log("EN: ", entropy)
    $(".generated_entropy").val(entropy);

    let progress = Math.round((entropy.length/LIM) * 100, 1)
    $(".percent_done").text(`${progress}%`);


  })
}

// Section Handlers
function selectSection(_section){
  for (let sec = 0; sec < state.sections.length; sec++) {
    $(`.${state.sections[sec]}`).hide();
  }

  $(`.${_section}`).show();
}


function populateProviders(){
  let provider_elems = ""
  for (let i = 0; i < state.providers.length; i++){
    provider_elems += `<option>${state.providers[i]}</option>`
  }
  return `<select class='form-control'>${provider_elems}</select>`;
}


// Page Load
$(window).ready(() => {

  $(`.${state.default_section}`).show();


  // Setting Initial Providers
  state.current_provider = state.default_provider;
  $("#provider_selection").html(populateProviders());
  // Wallet Handlers

  $('#lookupButton').click(async (ev)=>{
    let addr = $('#walletLookup').val();
    let walletInfoObj = await getWalletInfo(addr);
    let frame_to_place = buildWalletInfoView(walletInfoObj);

    $("#viewWalletInfo").show();
    $("#viewWalletInfo").html(frame_to_place);

  })

  $('.deriv_wallet').click((ev)=>{
    let words = $(".to_derive").val().trim();
    // words = validateWords(words);
    console.log(words)
    let wallet = webAtom.generateWalletFromSeed(words);
    $(".wallet_info").text(JSON.stringify(wallet))

  })

  $(".seed_words_button").click((ev)=>{
    let words = webAtom.generateSeed();

    $(".generated_words").val(words);
    $(".useSeedWords").show();

  })

  $(".useSeedWords").click((ev)=>{
    let words = $(".generated_words").val().trim()
    let wal_obj = webAtom.generateWalletFromSeed(words);
    $(".seedWordWallet").text(JSON.stringify(wal_obj))

  })

  $(".genEntropy").click((ev)=>{
    generateEntropyFromMouse();

  })

  $(".useEntropy").click((ev)=>{
    let wallet = webAtom.generateWalletFromSeed(String($(".generated_entropy").val()))
    $(".entropyWallet").text(JSON.stringify(wallet))
  })

  $(".upload_wallet").click(async (ev)=>{
    let words = $(".to_upload").val().trim();
    let wal_obj = webAtom.generateWalletFromSeed(words);
    let wal_auth = await lookupAuthAccount(wal_obj.cosmosAddress);
    console.log(wal_obj);
    console.log(wal_auth.value.coins)

    if (wal_auth.type == 'unused' || !wal_auth.value.coins ){
      window.alert("Please upload a wallet with a balance to build a transaction.")
    }
  })


})
