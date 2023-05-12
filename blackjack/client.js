const socket = io({autoConnect: false}), canvas = document.getElementById('canvas'), canvas2 = document.getElementById('canvas2');

const ctx = canvas.getContext('2d'), ctx2 = canvas2.getContext('2d'), nameForm = document.getElementById('name-form'), playing = document.getElementById('playing');

let win = 0, loose = 0, play = 0;

let playerName = localStorage.getItem('playerName'); // get playerName from local storage
if (playerName) {
  nameForm.style.display = 'none';
  socket.auth = { playerName };
  socket.connect();
  win = localStorage.getItem('win') || 0;
  play = localStorage.getItem('play') || 0;
  loose = localStorage.getItem('loose') || 0;
};
// Attach event listeners to the buttons
document.getElementById('hit').addEventListener('click', hit);
document.getElementById('stand').addEventListener('click', stand);
document.getElementById('show_deck').addEventListener('click', showDeck);
document.getElementById('deal').addEventListener('click', deal);
nameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!(document.getElementById('player-name').value == '<dealer>')) {
    playerName = document.getElementById('player-name').value;
    socket.auth = { playerName };
    socket.connect();
    nameForm.style.display = 'none';
    localStorage.setItem('playerName', playerName);
  }
});
window.onload = function() {
};
socket.on('gameState', data => {
  console.log('got game state');
  const dealerHand = data.dealerCards, player = data.players[playerName];

  drawDealerCards(dealerHand);
  ctx.clearRect( (dealerHand.length * 110),0, (canvas.width - (dealerHand.length * 110)), 160 );
  drawPlayerCards(player);
  ctx.clearRect( (player.hand.length * 110),160, (canvas.width - (player.hand.length * 110)), 160 );

  let order = 0;
  for (let playerID in data.players) {
    if (!(playerID == playerName)) {
      //console.log("another player: "+playerID)
      if (data.players[playerID].playing){
        drawOtherPlayerCards(data.players[playerID],order);
        ctx2.clearRect( (data.players[playerID].hand.length * 110),(order * 160), (canvas2.width - (data.players[playerID].hand.length * 110)), 160 );
        order++
      }
    }
  }
  let turn = player.turn;
  if (data.crazy && !data.gameover && !player.played) {
    turn = true;
  }
  setButtons(turn,data.gameover)
  
  if (player.winner) {
    //console.log('There is a winner, show it!');
    showWinner(player.winner)
  } else {
    const winnerElement = document.getElementById('winner');
    winnerElement.innerHTML = "&nbsp;";  
  }
  updateScores(player.score, data.dealerScore)


});
socket.onAny((event, ...args) => {
  console.log(event, args);
});
socket.on('connect', () => {
  console.log('Connected to server');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
socket.on('Show Deck', async data => {
  let x = 0;
  let y = 0;

  for (let card of data) {
    try {
      await new Promise((resolve, reject) => {
        let cardImage = new Image();
        cardImage.src = card.image;
        cardImage.onload = function() {
          const cardX = x
          ctx.drawImage(cardImage, cardX, y, 100, 150);
          x = x + 20;
          if (x > (canvas.width - 10)) {
            x=0;
            y=y+40;
          }
          resolve();
        }
        cardImage.onerror = reject;
      });
    } catch (err) {
      console.error(`Failed to load image: ${card.image}`, err);
    }
  }
});
socket.on('playing?', () => {
  if (playing.checked) {
    socket.emit('playing')
  }
  const winnerElement = document.getElementById('winner');
  winnerElement.innerHTML = "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
socket.on('slap', (userId) => {
  if (playing.checked && userId == playerName) {
    playing.checked = false;
  }
});
socket.on('disconnect', () => {
  console.log('Disconnected from server');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
function setButtons(playing,gameover) {
  document.getElementById('stand').disabled = !playing;
  document.getElementById('hit').disabled = !playing;
  document.getElementById('deal').disabled = !gameover;
  document.getElementById('show_deck').disabled = !gameover;
}
function showWinner(winner) {
  const winnerElement = document.getElementById('winner');
  winnerElement.innerHTML = `Winner: "${winner}"`;
  if ( winner == "dealer" ) {
    loose++
  } else if ( winner == "player" ) {
    win++
  } else if ( winner == "slapped" ){
    const chipImage = new Image();
    chipImage.src = './images/slap.gif';
    chipImage.onload = function() {
      ctx.drawImage(chipImage, 0, 160, 150, 150);
    }
  } else {
    play++
  }
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
  winnerElement.innerHTML = "&nbsp;";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
  playing.checked = true;
  socket.emit('deal');
}
function stand() {
  console.log('Send stand');
  socket.emit('stand');
}
function showDeck() {
  console.log('Show Deck');
  socket.emit('Show Deck');
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
      const cardX = x + (index * 110);
      ctx.drawImage(cardImage, cardX, y, 100, 150);
    
    }
  });

};
function drawPlayerCards(player) {
  // set the position of the first card
  let x = 0;
  let y = 160;

  // loop through the player's hand and draw each card in a separate position
  player.hand.forEach(card => {
    const cardImage = new Image();
    const cardX = x
    cardImage.src = card.image;
    cardImage.onload = function() {
      ctx.drawImage(cardImage, cardX, y, 100, 150);
    }
    if (player.winner == 'player' || player.winner == 'push') {
      const chipImage = new Image();
      chipImage.src = './images/red_chip.png';
      chipImage.onload = function() {
        ctx.drawImage(chipImage, cardX+20, y+20, 50, 50);
      }
    }
    if (player.winner == 'player') {
      const chipImage2 = new Image();
      chipImage2.src = './images/red_chip.png';
      chipImage2.onload = function() {
        ctx.drawImage(chipImage2, cardX+30, y+50, 50, 50);
      }
    } else if (player.winner == 'dealer') {
      const chipImage = new Image();
      chipImage.src = './images/loose.png';
      chipImage.onload = function() {
        ctx.drawImage(chipImage, cardX+20, y+45, 60, 60);
      }
    }
    x += 110;
  });
}
function drawOtherPlayerCards(player,position) {
  // set the position of the first card
  let x = 0;
  let y = (160 * position);

  // loop through the player's hand and draw each card in a separate position
  player.hand.forEach(card => {
    const cardImage = new Image(), cardX = x;
    cardImage.src = card.image;
    cardImage.onload = function() {
      ctx2.drawImage(cardImage, cardX, y, 100, 150);
    }
    if (player.winner == 'player' || player.winner == 'push') {
      const chipImage = new Image();
      chipImage.src = './images/red_chip.png';
      chipImage.onload = function() {
        ctx2.drawImage(chipImage, cardX+20, y+20, 50, 50);
      }
    }
    if (player.winner == 'player') {
      const chipImage2 = new Image();
      chipImage2.src = './images/red_chip.png';
      chipImage2.onload = function() {
        ctx2.drawImage(chipImage2, cardX+30, y+50, 50, 50);
      }
    } else if (player.winner == 'dealer') {
      const chipImage = new Image();
      chipImage.src = './images/loose.png';
      chipImage.onload = function() {
        ctx2.drawImage(chipImage, cardX+20, y+45, 60, 60);
      }
    }
    x += 110;
  });
}