// Import required modules
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

// Set up the server
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Start the server
const port = 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Send index file when there is a connection
app.use(express.static(__dirname + '/public'));
app.get('/', function (req, res) {
    res.sendFile('index.html');
});

app.set('js', 'text/javascript');
app.get('/client.js', function(req, res) {
	  res.set('Content-Type', app.get('js'));
	  res.sendFile(__dirname + '/client.js');
});

// Game state

const numDecks = 2;
const gameState = {
  players: {},
  playerHand: [],
  deck: [],
  dealerCards: [],
  currentPlayer: null,
  winner: null,
  gameOver: false,
};

io.on('connection', (socket) => {
  console.log('A user connected!');
  socket.on('startGame', () => {
    console.log('Starting a new game...');

    gameState.deck = shuffleDeck(shuffleDeck(initDeck(numDecks)));
    console.log('Shuffled Deck');
    initialDeal(socket)
  });

  socket.on('deal', () => {
    initialDeal(socket)
  });

  socket.on('hit', () => {
    console.log('hit');
    gameState.playerHand.push(gameState.deck.shift());

    let playerscore = calculateScore(gameState.playerHand);
    let dealerHand = [ { rank: 'Unknown', value: 0, suit: 'Unknown', image: 'images/red_back.png' } , gameState.dealerCards[1] ]

    if (playerscore > 21) {
      gameState.winner = 'dealer';
      gameState.gameOver = true;
    }

    let playerHand = gameState.playerHand;
    socket.emit('showHands', { dealerHand, playerHand, winner: gameState.winner, cardCount: gameState.deck.length });
  });

  socket.on('stand', () => {
    console.log('standing');
    let dealerHand = gameState.dealerCards;
    let playerHand = gameState.playerHand;
    socket.emit('showHands', { dealerHand, playerHand, winner: gameState.winner });

    let playerscore = calculateScore(playerHand);
    let dealerscore = calculateScore(dealerHand);
    while (dealerscore < 17) {
      dealerHand.push(gameState.deck.shift())
      socket.emit('showHands', { dealerHand, playerHand, winner: gameState.winner });
      dealerscore = calculateScore(dealerHand);
    }
    if (dealerscore > 21) {
      gameState.winner = 'player';
    } else if (dealerscore == playerscore) {
      gameState.winner = 'tie';
    } else if (dealerscore > playerscore) {
      gameState.winner = 'dealer';
    } else {
      gameState.winner = 'player';
    }
    socket.emit('showHands', { dealerHand, playerHand, winner: gameState.winner, cardCount: gameState.deck.length }); 
  });

});

function initialDeal(socket) {
    if (gameState.deck.length < 10) {
      gameState.deck = shuffleDeck(shuffleDeck(initDeck(numDecks)));
      console.log('Shuffled Deck');
    }

    gameState.playerHand = [];
    gameState.dealerCards = [];
    gameState.winner = null;
    gameState.playerHand.push(gameState.deck.shift());
    gameState.dealerCards.push(gameState.deck.shift());
    gameState.playerHand.push(gameState.deck.shift());
    gameState.dealerCards.push(gameState.deck.shift());

    let dealerscore = calculateScore(gameState.dealerCards);
    let playerscore = calculateScore(gameState.playerHand);

    let dealerHand = gameState.dealerCards
    if (playerscore == 21 && dealerscore == 21) {
      gameState.winner = 'tie';
    } else if (playerscore == 21) {
      gameState.winner = 'player';
    } else if (dealerscore == 21) {
      gameState.winner = 'dealer';
    } else {
      dealerHand = [ { rank: 'Unknown', value: 0, suit: 'Unknown', image: 'images/red_back.png' } , gameState.dealerCards[1] ]
    }

    let playerHand = gameState.playerHand
    // Send hands to the client
    socket.emit('showHands', { dealerHand, playerHand, winner: gameState.winner, cardCount: gameState.deck.length });
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

