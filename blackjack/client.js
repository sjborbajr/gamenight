const socket = io(); // Connect to the server using Socket.IO
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Draw the game board and cards
window.onload = function() {
  socket.emit('startGame');
};

socket.on('showHands', data => {
  const dealerHand = data.dealerHand;
  const playerHand = data.playerHand;

  drawDealerCards(dealerHand);
  drawPlayerCards(playerHand); 
  updateScores(calculateScore(playerHand), calculateScore(dealerHand));

  if (data.winner) {
    setButtonsEnabled(false);
    showWinner(data.winner);
  } else {
    setButtonsEnabled(true);
  }

});



// Attach event listeners to the buttons
document.getElementById('hit').addEventListener('click', hit);
document.getElementById('stand').addEventListener('click', stand);
document.getElementById('new_game').addEventListener('click', newGame);
document.getElementById('deal').addEventListener('click', deal);


// Listen for events from the server
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

// update page functions
function setButtonsEnabled(enabled) {
  document.getElementById('stand').disabled = !enabled;
  document.getElementById('hit').disabled = !enabled;
  document.getElementById('deal').disabled = enabled;
}
function showWinner(winner) {
  const winnerElement = document.getElementById('winner');
  winnerElement.innerHTML = `Winner: ${winner}`;
}
function updateScores(playerScore, dealerScore) {
  const scoreElement = document.getElementById('scores');
  scoreElement.innerHTML = `Player Score: ${playerScore} | Dealer Score: ${dealerScore}`;
}

// Send messages to the server
function hit() {
  socket.emit('hit');
}
function deal() {
  const winnerElement = document.getElementById('winner');
  winnerElement.innerHTML = "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit('deal');
}
function stand() {
  socket.emit('stand');
}
function newGame() {
  const winnerElement = document.getElementById('winner');
  winnerElement.innerHTML = "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit('startGame');
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

// create a function to draw the player's cards
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

// call the functions to draw the cards
