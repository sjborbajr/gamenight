// Import required modules
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

// Set up the server
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const path = require('path');
let joincount = 0;

// Start the server
const port = 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Send index file when there is a connection
app.use(express.static(path.join(__dirname,'public')));
app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname,'index.html'));
});

app.set('js', 'text/javascript');
app.get('/client.js', function(req, res) {
	  res.set('Content-Type', app.get('js'));
	  res.sendFile(path.join(__dirname,'client.js'));
});

// Game state

const numDecks = 2;
const gameStatePrivate = {
  deck: [],
  dealerCards: [],
  dealerScore: 0,
};
const gameStatePublic = {
  players: {},
  deckSize: 0,
  deckRemain: 0,
  dealerCards: [],
  currentPlayer: null,
};

io.on('connection', (socket) => {
  console.log('Player connected: $socket.id{}');

  addPlayer(socket.id);

  // Start the game if this is the first player
  if (Object.keys(gameStatePublic.players).length === 1) {
    console.log('Starting a new game...');
    gameStatePrivate.deck = shuffleDeck(shuffleDeck(initDeck(numDecks)));
    console.log('Shuffled Deck');
    dealHands();
    gameStatePublic.players[socket.id].playing = true;
    gameStatePublic.players[socket.id].turn = true;
  }

  // Send the initial game state to the player
  socket.emit('gameStatePublic', gameStatePublic);

  socket.on('hit', () => {
    console.log('Player ${socket.id} hit');
    let player = gameStatePublic.players[socketId];
    let deck = gameStatePrivate.deck;
        
    // Should we verify if it is the players turn? crazy idea, can any one hit at any time?
    if (player.turn = true) {
      player.hand.push(deck.shift());
      player.score = calculateScore(player.hand);

      if (player.score > 21) {
        player.turn = false;
      }
      socket.emit('gameStatePublic', gameStatePublic);
    }
  });

  socket.on('stand', () => {
    console.log('standing');
    let player = gameStatePublic.players[socketId];
    
    player.turn = false;
    
    //' more work needed
    gameStatePublic.dealerCards = gameStatePrivate.dealerCards
    socket.emit('gameStatePublic', gameStatePublic);
  });

});
function playDealer() {
    let dealerscore = calculateScore(dealerHand);
    while (dealerscore < 17) {
      dealerHand.push(gameState.deck.shift())
      socket.emit('showHands', { dealerHand, playerHand, winner: gameState.winner });
      dealerscore = calculateScore(dealerHand);
    }
}
function addPlayer(socketId) {
  // winner being null = undecided
  gameStatePublic.players[socketId] = {
    hand: [],
    score: 0,
    join_order: joincount++,
    playing: false,
    turn: false,
    winner: null,
  };
}
function removePlayer(socketId) {
  delete gameStatePlublic.players[socketId];
}
function dealHands() {
  let dealerHand = gameStatePublic.dealerCards;
  let dealerHandCopy = gameStatePrivate.dealerCards;
  let deck = gameStatePrivate.deck.shift();

  //deal first card to everyone
  for (let player in gameStatePublic.players) {
    player.hand.push(deck.shift());
  }
  dealerHand.push(deck.shift())

  //add place holder for dealers first card
  dealerHandCopy.push({ rank: 'Unknown', value: 0, suit: 'Unknown', image: 'images/red_back.png' })

  //deal second card to everyone
  for (let player in gameStatePublic.players) {
    player.hand.push(deck.shift());
    player.score = calculateScore(player.hand);
    player.winner = null;
  }
  dealerHand.push(gameState.deck.shift());
  gameStatePrivate.dealerScore = calculateScore(dealerHand);
  
  //everyone can see dealers second card
  dealerHandCopy.push(dealerHand[1]);

}

// Initialize the deck of cards
function initDeck(numDecks) {
  numDecks = numDecks || 1; // Set a default value for numDecks
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = [
    { name: 'ace', value: 11 },
    { name: '2', value: 2 },
    { name: '3', value: 3 },
    { name: '4', value: 4 },
    { name: '5', value: 5 },
    { name: '6', value: 6 },
    { name: '7', value: 7 },
    { name: '8', value: 8 },
    { name: '9', value: 9 },
    { name: '10', value: 10 },
    { name: 'jack', value: 10 },
    { name: 'queen', value: 10 },
    { name: 'king', value: 10 },
  ];

  const deck = [];
  for (let d = 0; d < numDecks; d++) {
    for (let i = 0; i < suits.length; i++) {
      for (let j = 0; j < ranks.length; j++) {
        deck.push({
          suit: suits[i],
          rank: ranks[j].name,
          value: ranks[j].value,
          image: "images/"+ ranks[j].name+"_of_"+suits[i]+".png",
        });
      }
    }
  }
  return deck;
}
// Shuffle the deck of cards
  // Move from the last position to the first and select a random card
  // from the remaining cards to put in that position.
function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck
}
function checkWinner (player) {
  let dealerHand = gameStatePublic.dealerCards;

    
  if (dealerscore > 21) {
    gameState.winner = 'player';
  } else if (dealerscore == playerscore) {
    gameState.winner = 'push';
  } else if (dealerscore > playerscore) {
    gameState.winner = 'dealer';
  } else {
    gameState.winner = 'player';
  }
}
// Calculate the score of a hand
function calculateScore(cards) {
  let score = cards.reduce((sum, card) => sum + card.value, 0);
  let numAces = cards.filter((card) => card.rank === 'ace').length;
  while (numAces > 0 && score > 21) {
    score -= 10;
    numAces--;
  }
  return score;
}

