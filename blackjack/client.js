const socket = io({autoConnect: false}); // Connect to the server using Socket.IO
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let win = 0;
let loose = 0;
let play = 0;
let userId = null;
let playerName = localStorage.getItem('playerName'); // get playerName from local storage
const nameForm = document.getElementById('name-form');

// Draw the game board and cards
window.onload = function() {
  //should I do anything on load?
};
socket.on('gameState', data => {
  console.log('got game state');
  const dealerHand = data.dealerCards;
  const player = data.players[playerName];

  drawDealerCards(dealerHand);
  drawPlayerCards(player.hand); 
  
  setButtons(player.turn)

});
socket.onAny((event, ...args) => {
  console.log(event, args);
});
// Attach event listeners to the buttons
document.getElementById('hit').addEventListener('click', hit);
document.getElementById('stand').addEventListener('click', stand);
document.getElementById('new_game').addEventListener('click', newGame);
document.getElementById('deal').addEventListener('click', deal);
const storedPlayerName = localStorage.getItem('playerName');
if (storedPlayerName) {
  playerName = storedPlayerName;
  nameForm.style.display = 'none';
  socket.auth = { playerName };
  socket.connect();
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

// Listen for events from the server
socket.on('connect', () => {
  console.log('Connected to server');

});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

// update page functions
function setButtons(enabled) {
  console.log('setting buttons: '+enabled);
  if (enabled) {
    console.log('hit/stand on');
  } else {
    console.log('deal/new on');
  }
  document.getElementById('stand').disabled = !enabled;
  document.getElementById('hit').disabled = !enabled;
  document.getElementById('deal').disabled = enabled;
  document.getElementById('new_game').disabled = enabled;
}
function showWinner(winner) {
  const winnerElement = document.getElementById('winner');
  winnerElement.innerHTML = `Winner: "${winner}"`;
  if ( winner === "dealer" ) {
    loose++
  } else if ( winner === "player" ) {
    win++
  }
  play++
}
function updateScores(playerScore, dealerScore) {
  const scoreElement = document.getElementById('scores');
  scoreElement.innerHTML = `Player: ${playerScore} | Dealer: ${dealerScore} | Win: ${win} | Loose: ${loose} | Play ${play}`;
}

// Send messages to the server
function hit() {
  console.log('Send hit');
  socket.emit('hit');
}
function deal() {
  console.log('Send deal');
  const winnerElement = document.getElementById('winner');
  winnerElement.innerHTML = "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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

// create a function to draw the dealer's cards
function drawDealerCards(dealerHand) {
  // set the position of the first card
  let x = 0;
  let y = 0;
  // loop through the dealer's hand and draw each card in a separate position
  dealerHand.forEach((card, index) => {
    const cardImage = new Image();
    cardImage.onload = function() {
      const cardX = x + (index * 120);
      ctx.drawImage(cardImage, cardX, y, 100, 150);
    }
    cardImage.src = card.image;
  });
}

function drawPlayerCards(playerHand) {
  // set the position of the first card
  let x = 0;
  let y = 200;

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

function calculateScore(cards) {
  let score = cards.reduce((sum, card) => sum + card.value, 0);
  let numAces = cards.filter((card) => card.rank === 'ace').length;
  while (numAces > 0 && score > 21) {
    score -= 10;
    numAces--;
  }
  return score;
}
