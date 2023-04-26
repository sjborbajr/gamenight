const socket = io({autoConnect: false}); // Connect to the server using Socket.IO
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const nameForm = document.getElementById('name-form');
const playing = document.getElementById('playing');

let win = 0;
let loose = 0;
let play = 0;
let playerName = localStorage.getItem('playerName'); // get playerName from local storage

// Attach event listeners to the buttons
document.getElementById('hit').addEventListener('click', hit);
document.getElementById('stand').addEventListener('click', stand);
document.getElementById('new_game').addEventListener('click', newGame);
document.getElementById('deal').addEventListener('click', deal);
if (playerName) {
  nameForm.style.display = 'none';
  socket.auth = { playerName };
  socket.connect();
  win = localStorage.getItem('win');
  play = localStorage.getItem('play');
  loose = localStorage.getItem('loose');
}
nameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  playerName = document.getElementById('player-name').value;
  socket.auth = { playerName };
  socket.connect();
  if (playerName) {
    nameForm.style.display = 'none';
    localStorage.setItem('playerName', playerName);
  }
});
window.onload = function() {
};
socket.on('gameState', data => {
  console.log('got game state');
  const dealerHand = data.dealerCards;
  const player = data.players[playerName];

  drawDealerCards(dealerHand);
  drawPlayerCards(player.hand);
  
  for (let playerID in data.players) {
    if (!(playerID == playerName)){
      //console.log("another player: "+playerID)
      drawOtherPlayerCards(data.players[playerID].hand);
    }
  }
  
  setButtons(player.turn,data.gameover)
  
  if (player.winner) {
    console.log('There is a winner, show it!');
    showWinner(player.winner)
  }
  updateScores(calculateScore(player.hand), calculateScore(dealerHand))


});
socket.onAny((event, ...args) => {
  console.log(event, args);
});
socket.on('connect', () => {
  console.log('Connected to server');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
socket.on('playing?', () => {
  if (playing.checked) {
    socket.emit('playing')
  }
  const winnerElement = document.getElementById('winner');
  winnerElement.innerHTML = "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
socket.on('disconnect', () => {
  console.log('Disconnected from server');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
function setButtons(playing,gameover) {
  document.getElementById('stand').disabled = !playing;
  document.getElementById('hit').disabled = !playing;
  document.getElementById('deal').disabled = !gameover;
  //document.getElementById('new_game').disabled = !gameover;
}
function showWinner(winner) {
  const winnerElement = document.getElementById('winner');
  winnerElement.innerHTML = `Winner: "${winner}"`;
  if ( winner == "dealer" ) {
    loose++
  } else if ( winner == "player" ) {
    win++
  }
  play++
  localStorage.setItem('win', win);
  localStorage.setItem('loose', loose);
  localStorage.setItem('play', play);
}
function updateScores(playerScore, dealerScore) {
  const scoreElement = document.getElementById('scores');
  scoreElement.innerHTML = `Player: ${playerScore} | Dealer: ${dealerScore} | Win: ${win} | Loose: ${loose} | Play ${play}`;
}
function hit() {
  console.log('Send hit');
  socket.emit('hit');
}
function deal() {
  console.log('Send deal');
  const winnerElement = document.getElementById('winner');
  winnerElement.innerHTML = "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  playing.checked = true;
  socket.emit('deal');
}
function stand() {
  console.log('Send stand');
  socket.emit('stand');
}
function newGame() {
  const winnerElement = document.getElementById('winner');
  winnerElement.innerHTML = "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
function drawDealerCards(dealerHand) {
  // set the position of the first card
  let x = 0;
  let y = 0;
  // loop through the dealer's hand and draw each card in a separate position
  dealerHand.forEach((card, index) => {
    let cardImage = new Image();
    cardImage.src = card.image;
    cardImage.onload = function() {
      const cardX = x + (index * 120);
      ctx.drawImage(cardImage, cardX, y, 100, 150);
    }
    if (1 == 2) {
      cardImage.src = card.image;
      cardImage.onload = function() {
        var imgbase64 = new fabric.Image(cardImage, {
          width: 100,
          height: 150
        })
        canvas.add(imgbase64);
        canvas.deactivateAll().renderAll();
      }
    }
  });
}
function drawPlayerCards(playerHand) {
  // set the position of the first card
  let x = 0;
  let y = 160;

  // loop through the player's hand and draw each card in a separate position
  playerHand.forEach(card => {
    const cardImage = new Image();
    const cardX = x
    cardImage.src = card.image;
    cardImage.onload = function() {
      ctx.drawImage(cardImage, cardX, y, 100, 150);
    }
    x += 120
  });
}
function drawOtherPlayerCards(playerHand) {
  // set the position of the first card
  let x = 0;
  let y = 320;

  // loop through the player's hand and draw each card in a separate position
  playerHand.forEach(card => {
    const cardImage = new Image();
    const cardX = x
    cardImage.src = card.image;
    cardImage.onload = function() {
      ctx.drawImage(cardImage, cardX, y, 50, 75);
    }
    x += 60
  });
}
function calculateScore(cards) {
  let score = cards.reduce((sum, card) => sum + card.value, 0);
  let numAces = cards.filter((card) => card.rank === 'ace').length;
  while (numAces > 0 && score > 21) {
    score -= 10;
    numAces--;
  }
  return score;
}