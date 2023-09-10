const socket = io({autoConnect: false});

let playerName = '', currentTab = localStorage.getItem('currentTab') || 'Home';

window.onload = function() {
  let playerNameRead = localStorage.getItem('playerName'); // get playerName from local storage
  if (playerNameRead) {
    document.getElementById('player-name').value = playerNameRead
    connectButton();
  };
  if(document.getElementById(currentTab+'Btn')){
    document.getElementById(currentTab+'Btn').click();
  } else {
    document.getElementById("HomeBtn").click();
  }
};
socket.onAny((event, ...args) => {
  if (event != 'settings'){
    console.log(event, args);
  }
});
socket.on('serverRole', role => {
  if (role == 'admin') {
    document.getElementById('SystemBtn').style.display = 'inline';
    setTimeout(function() {
      document.getElementById('HomeBtn').style.width = '33.3%'
      document.getElementById('GameBtn').style.width = '33.3%'
      document.getElementById('SystemBtn').style.width = '33.4%'
    }, 100);
  };
});
socket.on('error', data => {
  alert (data);
  if (data == 'user not authenticated'){
    document.getElementById('player-name').value = ''
    localStorage.removeItem('playerName');
    localStorage.removeItem('authNonce');
  }
});
socket.on('alertMsg',data => {
  document.getElementById('alertMsg').style.color = data.color;
  document.getElementById('alertMsg').innerText = data.message;
  document.getElementById('alertMsg').style.display = 'inline';
  setTimeout(()=> document.getElementById('alertMsg').style.display = 'none',data.timeout);
});
socket.on('connect', () => {
  //console.log('Connected to server');
  document.getElementById('player-name').disabled = true;
  document.getElementById('disconnectButton').disabled = false;
  document.getElementById('connectButton').innerText = 'Change';
  localStorage.setItem('playerName', playerName);
  document.getElementById('alertMsg').style.color = "#4CAF50";
  document.getElementById('alertMsg').innerText = "Connected to server";
  document.getElementById('alertMsg').style.display = 'inline';
  setTimeout(()=> document.getElementById('alertMsg').style.display = 'none',1500);

  document.getElementById('HomeBtn').style.width = '50%'
  document.getElementById('GameBtn').style.width = '50%'
  document.getElementById('GameBtn').style.display = 'inline';

});
socket.on('nameChanged', (name) => {
  localStorage.setItem('playerName', name);
  playerName = name
  document.getElementById('player-name').disabled = true;
  document.getElementById('player-name').value = name;
  document.getElementById('connectButton').innerText = 'Change';
});
socket.on('nonce', (nonce) => {
  localStorage.setItem('authNonce', nonce);
});
socket.on('disconnect', () => {
  console.log('Disconnected from server');
  document.getElementById('connectButton').disabled = false;
  document.getElementById('connectButton').innerText = 'Connect';
  document.getElementById('disconnectButton').disabled = true;
  document.getElementById('player-name').disabled = false;
  document.getElementById('alertMsg').style.color = "red";
  document.getElementById('alertMsg').innerText = "Disconnected from server";
  document.getElementById('alertMsg').style.display = 'inline';

  document.getElementById('HomeBtn').style.width = '100%'
  document.getElementById('GameBtn').style.display = 'none';
  document.getElementById('SystemBtn').style.display = 'none';
});
function connectButton() {
  let temp = document.getElementById('player-name').value
  document.getElementById('player-name').value = temp.trim().replace(/[^a-zA-Z0-9]/g,'');
  if (document.getElementById('player-name').value.length == 0) {
    alert('name must not be empty')
  } else if (document.getElementById('connectButton').innerText == 'Connect' && document.getElementById('player-name').value.length > 0){
    playerName = document.getElementById('player-name').value;
    let authNonce = localStorage.getItem('authNonce') || '';
    socket.auth = { playerName, authNonce };
    socket.connect();
    //console.log('connect attempt')
  } else if (document.getElementById('player-name').disabled && document.getElementById('connectButton').innerText == 'Change') {
    //console.log('enabling change name feature')
    document.getElementById('player-name').disabled = false;
    document.getElementById('connectButton').innerText = 'Suggest';
  } else {
    //console.log('requesting name change')
    socket.emit("changeName",document.getElementById('player-name').value);
  }
}
function disconnectButton() {
  socket.disconnect();
}
function showTab(elmnt) {
  let pageName = elmnt.id.substring(0,elmnt.id.length-3)
  let tabcontent = document.getElementsByClassName("tabcontent");
  //hide all content
  for (let i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  //reset color
  let tablinks = document.getElementsByClassName("tablink");
  for (let i = 0; i < tablinks.length; i++) {
    tablinks[i].style.backgroundColor = "";
  }
  //show the right page
  document.getElementById(pageName).style.display = "block";
  //set tab color
  let colors = {
    HomeBtn:'green',
    GameBtn:'blue',
    SystemBtn:'red'
  }
  elmnt.style.backgroundColor = colors[elmnt.id];
  //tell the server which tab was selected
  if (!document.getElementById('disconnectButton').disabled){
    socket.emit('tab',pageName);
  }
  //remember which tab was last
  localStorage.setItem('currentTab',pageName);
}
function toggleNav() {
  if (document.getElementById("mySidepanel").style.width < 1 || document.getElementById("mySidepanel").style.width == "0px") {
    document.getElementById("mySidepanel").style.width = "33%";
  } else {
    document.getElementById("mySidepanel").style.width = "0";
  }
}
function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}
function refreshConnected() {
  socket.emit("refreshConnected","");
}
function refreshGames() {
  socket.emit("refreshGames","");
}
function createGame() {
  socket.emit("createGame",{gameName:document.getElementById('game_name').value});
}
function joinGame() {
  let selected = document.querySelector('li.selected');
  if (selected){
    if (selected.value == 'startingGame'){
      socket.emit('joinParty',{gameId:selected.id})
    }
  }
}

