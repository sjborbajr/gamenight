// Import required modules
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cookieParser = require('cookie-parser');

// Set up the server
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const path = require('path');
let joincount = 0;
const disconnectedPlayers = {};
let cardcount = 0;

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
  dealerScore: null,
};

io.on('connection', (socket) => {
  // Get the user id from handshake
  const userId = socket.handshake.auth.playerName;
  console.log('User connected: '+userId);
  if ( !(gameStatePublic.players[userId])) {
    addPlayer(userId);
    
    // Start the game if this is the first player
    if (Object.keys(gameStatePublic.players).length === 1) {
      console.log('Starting a new game...');
      gameStatePrivate.deck = shuffleDeck(shuffleDeck(initDeck(numDecks)));
      gameStatePublic.deckSize = (numDecks * 52);
      dealHands();
      gameStatePublic.players[userId].playing = true;
      gameStatePublic.players[userId].turn = true;
    }
  }

  // Send current game state to the player
  socket.emit('Running Count: ', cardcount);
  socket.emit('True Count: ', (cardcount/(gameStatePublic.deckSize/52)));
  socket.emit('gameState', gameStatePublic);

  socket.onAny((event, ...args) => {
    console.log(event, args);
  });

  socket.on('hit', () => {
    console.log('Player '+userId+' hit.');
        
    // Should we verify if it is the players turn? crazy idea, can any one hit at any time?
    if (gameStatePublic.players[userId].turn == true) {
      gameStatePublic.players[userId].hand.push(gameStatePrivate.deck.shift());
      countcards(gameStatePublic.players[userId].hand[gameStatePublic.players[userId].hand.length-1])
      gameStatePublic.players[userId].score = calculateScore(gameStatePublic.players[userId].hand);
      gameStatePublic.deckRemain = gameStatePrivate.deck.length;

      if (gameStatePublic.players[userId].score > 21) {
        console.log('Player '+userId+' busted');
        gameStatePublic.players[userId].turn = false;
        gameStatePublic.players[userId].winner = false;
      }

      console.log('Deck Card Count: '+gameStatePrivate.deck.length);
      socket.emit('Running Count: ', cardcount);
      socket.emit('True Count: ', (cardcount/(gameStatePublic.deckSize/52)));
      socket.emit('gameState', gameStatePublic);
    } else {
      console.log('Not Players turn');
    }
  });
  socket.on('deal', () => {
    if (gameStatePrivate.deck.length < 10) {
      gameStatePrivate.deck = shuffleDeck(shuffleDeck(initDeck(numDecks)));
      gameStatePublic.deckSize = (numDecks * 52);
    }
    dealHands()
    gameStatePublic.players[userId].playing = true;
    gameStatePublic.players[userId].turn = true;

    socket.emit('Running Count: ', cardcount);
    socket.emit('True Count: ', (cardcount/(gameStatePublic.deckSize/52)));
    socket.emit('gameState', gameStatePublic);
  });
  socket.on('stand', () => {
    console.log('standing');
    gameStatePublic.players[userId].turn = false;
    
    //' more work needed
    gameStatePublic.dealerCards = gameStatePrivate.dealerCards
    countcards(gameStatePublic.dealerCards[0])

    socket.emit('Running Count: ', cardcount);
    socket.emit('True Count: ', (cardcount/(gameStatePublic.deckSize/52)));
    socket.emit('gameState', gameStatePublic);
    playDealer();
    checkWinner(gameStatePublic.players[userId]);
    

    socket.emit('Running Count: ', cardcount);
    socket.emit('True Count: ', (cardcount/(gameStatePublic.deckSize/52)));
    socket.emit('gameState', gameStatePublic);
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', userId);
  
    // Store the player's state and start a timer
    //disconnectedPlayers[userId] = {
    //  state: gameStatePublic.players[userId],
    //  timer: setTimeout(() => {
    //    console.log('Player gone for over 30 seconds:', userId);
    //    gameStatePrivate.deck = shuffleDeck(shuffleDeck(initDeck(numDecks)));
    //    removePlayer(userId);
    //    delete disconnectedPlayers[userId];
    //  }, 30000), // 30 seconds
    //};
  });
});
function playDealer() {
    let dealerScore = calculateScore(gameStatePublic.dealerCards);
    while (dealerScore < 17) {
      gameStatePublic.dealerCards.push(gameStatePrivate.deck.shift())
      countcards(gameStatePublic.dealerCards[gameStatePublic.dealerCards.length-1])
      dealerScore = calculateScore(gameStatePublic.dealerCards);
    }
    gameStatePrivate.dealerCards = gameStatePublic.dealerCards;
    gameStatePublic.dealerScore = dealerScore;
    gameStatePublic.score = dealerScore;
    gameStatePublic.deckRemain = gameStatePrivate.deck.length;
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
  let count = 0;
  //deal first card to everyone
  for (let playerID in gameStatePublic.players) {
    gameStatePublic.players[playerID].hand = [gameStatePrivate.deck.shift()];
    countcards(gameStatePublic.players[playerID].hand[0])
    count++
  }
  gameStatePrivate.dealerCards = [gameStatePrivate.deck.shift()];

  //add place holder for dealers first card
  gameStatePublic.dealerCards = [{ rank: 'Unknown', value: 0, suit: 'Unknown', image: 'images/red_back.png' }];

  //deal second card to everyone
  for (let playerID in gameStatePublic.players) {
    gameStatePublic.players[playerID].hand.push(gameStatePrivate.deck.shift());
    countcards(gameStatePublic.players[playerID].hand[1])
    gameStatePublic.players[playerID].score = calculateScore(gameStatePublic.players[playerID].hand);
    gameStatePublic.players[playerID].winner = null;
  }
  gameStatePrivate.dealerCards.push(gameStatePrivate.deck.shift());
  gameStatePrivate.dealerScore = calculateScore(gameStatePrivate.dealerCards);
  
  //everyone can see dealers second card
  gameStatePublic.dealerCards.push(gameStatePrivate.dealerCards[1]);
  countcards(gameStatePublic.dealerCards[gameStatePublic.dealerCards.length-1])

  console.log('Dealt '+Object.keys(gameStatePublic.players).length+' player and dealer a new hand');
  console.log('Deck Card Count: '+gameStatePrivate.deck.length);
  gameStatePublic.deckRemain = gameStatePrivate.deck.length;
  gameStatePublic.dealerScore = null;

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
function shuffleDeck(deck) {
  // Shuffle the deck of cards
  // Move from the last position to the first and select a random card
  // from the remaining cards to put in that position.
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  console.log('Shuffled Deck with '+deck.length+' cards.');
  return deck
}
function checkWinner (player) {
  console.log('card count: '+player.hand.length);
  if (gameStatePublic.dealerScore > 21) {
    player.winner = 'player';
  } else if (player.score == 21 && player.hand.length == 2 && !(gameStatePublic.dealerScore == 21 && gameStatePublic.dealerCards.length == 2)) {
    player.winner = 'winner';
  } else if (gameStatePublic.dealerScore == player.score) {
    player.winner = 'push';
  } else if (gameStatePublic.dealerScore > player.score) {
    player.winner = 'dealer';
  } else {
    player.winner = 'player';
  }
}
// Calculate the score of a hand
function calculateScore(hand) {
  let score = hand.reduce((sum, card) => sum + card.value, 0);
  let numAces = hand.filter((card) => card.rank === 'ace').length;
  while (numAces > 0 && score > 21) {
    score -= 10;
    numAces--;
  }
  return score;
}
function countcards(card){
  if (card.value > 9) {
    cardcount--
  } else if (card.value < 7) {
    cardcount++
  }
}
