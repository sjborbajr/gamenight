// Import required modules
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');

// Set up the server
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const path = require('path');
let joincount = 0;
let cardcount = 0;
let turnTimeout = null;

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

//app.set('js', 'text/javascript');
app.get('/client.js', function(req, res) {
	  res.set('Content-Type', 'text/javascript');
	  res.sendFile(path.join(__dirname,'client.js'));
});


const gameStatePrivate = JSON.parse(fs.readFileSync('gameStatePrivate.json'));
const gameStatePublic = JSON.parse(fs.readFileSync('gameStatePublic.json'));
// Create initial game state variables
//const gameStatePrivate = {
//  deck: [],
//  dealerCards: [],
//  dealerScore: 0,
//};
//const gameStatePublic = {
//  players: {},
//  deckSize: 0,
//  deckRemain: 0,
//  dealerCards: [],
//  dealerScore: null,
//  gameover: null,
//  trueCount: 0,
//  crazy: false,
//};

setInterval(ServerEvery1Second, (1*1000));

for (let playerID in gameStatePublic.players) {
  gameStatePublic.players[playerID].connected = false;
}

io.on('connection', (socket) => {
  // Get the user id from handshake
  const userId = socket.handshake.auth.playerName;
  if (userId == "<dealer>"){
    socket.emit("error","invalid user")
    socket.disconnect();

  } else {

    console.log('User connected: '+userId);
    if ( !(gameStatePublic.players[userId])) {
      addPlayer(userId);
      
      // Start the game if this is the first player
      if (Object.keys(gameStatePublic.players).length === 1) {
        console.log('Starting a new game...');
        gameStatePublic.deckSize = 2;
        gameStatePrivate.deck = shuffleDeck(shuffleDeck(initDeck(gameStatePublic.deckSize)));
        gameStatePublic.players[userId].playing = true;
        dealHands();
        gameStatePublic.players[userId].turn = true;
      } else {
        socket.broadcast.emit('new player', userId);
        socket.emit('message', "game in progress, wait for next deal");
      }
    }
    gameStatePublic.players[userId].connected = true;
    io.emit('gameState', gameStatePublic);
    // Send current game state to the player
    socket.onAny((event, ...args) => {
      console.log(event, args);
    });
    
    socket.on('hit', () => {
      console.log('Player '+userId+' hit.');
      // Should we verify if it is the players turn? crazy idea, can any one hit at any time?
      if (gameStatePublic.players[userId].turn == true || gameStatePublic.crazy == true) {
        gameStatePublic.players[userId].hand.push(gameStatePrivate.deck.shift());
        countcards(gameStatePublic.players[userId].hand[gameStatePublic.players[userId].hand.length-1])
        gameStatePublic.players[userId].score = calculateScore(gameStatePublic.players[userId].hand);
        gameStatePublic.deckRemain = gameStatePrivate.deck.length;
        
        if (gameStatePublic.players[userId].score > 21) {
          console.log('Player '+userId+' busted');
          gameStatePublic.players[userId].turn = false;
          gameStatePublic.players[userId].played = true;
          
          let nextPlayer = getNextPlayer();
          console.log('Next Player '+nextPlayer);
          if (!(nextPlayer == "<dealer>")){
            gameStatePublic.players[nextPlayer].turn = true;
          } else if (nextPlayer == "<dealer>") {
            playDealer(socket);
          } else {
            gameStatePublic.gameover = true;
          }
        }
        
        sendState(socket);
      } else {
        console.log('Not Players turn');
        socket.emit('turn', 'Not your turn');
      }
    });
    socket.on('deal', () => {
      for (let playerID in gameStatePublic.players) {
        gameStatePublic.players[playerID].playing = false;
      };
      socket.broadcast.emit('playing?', 'deal');
      if (gameStatePrivate.deck.length < (5*(Object.keys(gameStatePublic.players).length + 1))) {
        gameStatePublic.deckSize = Object.keys(gameStatePublic.players).length + 1;
        gameStatePrivate.deck = shuffleDeck(shuffleDeck(initDeck(gameStatePublic.deckSize)));
      }
      gameStatePublic.players[userId].playing = true;
      gameStatePublic.players[userId].turn = true;
      setTimeout(() => {
        dealHands();
        sendState(socket);
      }, 250 );
    });
    socket.on('stand', () => {
      if (gameStatePublic.players[userId].turn == true) {
        console.log(userId+' is standing');
        gameStatePublic.players[userId].turn = false;
        gameStatePublic.players[userId].played = true;
        
        let nextPlayer = getNextPlayer();
        if (!(nextPlayer == "<dealer>")){
          gameStatePublic.players[nextPlayer].turn = true;
          sendState(socket);
        } else {
          playDealer(socket);
        }
      } else {
        console.log('Not Players turn');
        socket.emit('turn', 'Not your turn');
      }
    });
    socket.on('playing', () => {
      if (gameStatePublic.gameover == true) {
        gameStatePublic.players[userId].playing = true;
      }
    });
    socket.on('disconnect', () => {
      console.log('Player disconnected:', userId);
      gameStatePublic.players[userId].connected = false;
      setTimeout(() => {
        checkAndRemovePlayer(userId);
      }, (15*60*1000));
    });
  }
});
function sendState(socket) {
  gameStatePublic.trueCount = (cardcount/(gameStatePublic.deckSize));
  io.emit('gameState', gameStatePublic);
  if (turnTimeout) {
    clearTimeout(turnTimeout);
    turnTimeout = null;
  }
  let currentPlayer = getCurrentPlayer();
  if (!gameStatePublic.gameover) {
    if (gameStatePublic.players[socket.handshake.auth.playerName].turn){
      console.log("set timeout for "+socket.handshake.auth.playerName);
      turnTimeout = setTimeout(() => { handleInactivity(socket.handshake.auth.playerName); }, ( 30 * 1000 ));
    }
  }
  //socket.broadcast.emit('gameState', gameStatePublic);
  fs.writeFileSync('gameStatePrivate.json', JSON.stringify(gameStatePrivate, null, 2));
  fs.writeFileSync('gameStatePublic.json', JSON.stringify(gameStatePublic, null, 2));
}
function playDealer(socket) {
    //show the dealers hand
    gameStatePublic.dealerCards = gameStatePrivate.dealerCards;
    countcards(gameStatePublic.dealerCards[0]);
    sendState(socket);

    //play the dealers hand out
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
    resolveWinner();
    gameStatePublic.gameover = true;
    
    //give a time so they can see the dealer card before playing the hand
    setTimeout(() => {
      sendState(socket);
    }, 250 );
}
function handleInactivity(userId) {
  console.log("Hey! "+userId+" you are SLOW!!")
  clearTimeout(turnTimeout);
  turnTimeout = null;

  if (gameStatePublic.players[userId].connected){
    io.emit("slap",userId)
  }

  //take away users hand and remove them from play
  gameStatePublic.players[userId].hand = [];
  gameStatePublic.players[userId].playing = false;
  gameStatePublic.players[userId].turn = false;
  gameStatePublic.players[userId].played = true;

  let nextPlayer = getNextPlayer();
  if (nextPlayer == "<dealer>"){
    playDealer(io)
  } else if (nextPlayer) {
    gameStatePublic.players[nextPlayer].turn = true;
  }
}
function addPlayer(userId) {
  console.log('adding user: '+userId)
  // winner being null = undecided
  gameStatePublic.players[userId] = {
    hand: [],
    score: 0,
    join_order: joincount++,
    playing: false,
    played: false,
    turn: false,
    winner: null,
  };
}
function checkAndRemovePlayer(userId) {
  if (gameStatePublic.players[userId]) {
    if (!(gameStatePublic.players[userId].connected)) {
      //I don't think I should do this
      //maybe move to redis?
      //console.log('deleting user: '+userId)
      //delete gameStatePublic.players[userId];
    }
  }
  //sendState(socket);
}
function dealHands() {
  let count = 0;
  //deal first card to everyone
  for (let playerID in gameStatePublic.players) {
    if (gameStatePublic.players[playerID].playing){
      gameStatePublic.players[playerID].hand = [gameStatePrivate.deck.shift()];
      countcards(gameStatePublic.players[playerID].hand[0])
      count++
    } else {
      gameStatePublic.players[playerID].hand = [];
      gameStatePublic.players[playerID].winner = null;
    }
  }
  gameStatePrivate.dealerCards = [gameStatePrivate.deck.shift()];

  //add place holder for dealers first card
  gameStatePublic.dealerCards = [{ rank: 'Unknown', value: 0, suit: 'Unknown', image: 'images/red_back.png' }];

  //deal second card to everyone
  for (let playerID in gameStatePublic.players) {
    if (gameStatePublic.players[playerID].playing){
      gameStatePublic.players[playerID].hand.push(gameStatePrivate.deck.shift());
      countcards(gameStatePublic.players[playerID].hand[1])
      gameStatePublic.players[playerID].score = calculateScore(gameStatePublic.players[playerID].hand);
      gameStatePublic.players[playerID].winner = null;
      gameStatePublic.players[playerID].played = false;
    }
  }
  gameStatePrivate.dealerCards.push(gameStatePrivate.deck.shift());
  gameStatePrivate.dealerScore = calculateScore(gameStatePrivate.dealerCards);
  
  //everyone can see dealers second card
  gameStatePublic.dealerCards.push(gameStatePrivate.dealerCards[1]);
  countcards(gameStatePublic.dealerCards[gameStatePublic.dealerCards.length-1]);

  console.log('Dealt '+Object.keys(gameStatePublic.players).length+' player and dealer a new hand');
  console.log('Deck Card Count: '+gameStatePrivate.deck.length);
  gameStatePublic.deckRemain = gameStatePrivate.deck.length;
  gameStatePublic.dealerScore = null;
  gameStatePublic.gameover = false;

}
function getNextPlayer() {
  let nextPlayer = null;
  let allBust = true;
  for (let playerID in gameStatePublic.players) {
    if (nextPlayer == null){
      if (gameStatePublic.players[playerID].playing == true && gameStatePublic.players[playerID].played == false) {
        nextPlayer = playerID;
      }
    }
    if (gameStatePublic.players[playerID].score < 22) {
      allBust = false;
    }
  }
  if (nextPlayer == null && !allBust){
    nextPlayer = "<dealer>"
  }
  return nextPlayer
}
function getCurrentPlayer() {
  let currentPlayer = null;
  for (let playerID in gameStatePublic.players) {
    if (currentPlayer == null){
      if (gameStatePublic.players[playerID].playing == true && gameStatePublic.players[playerID].played == false) {
        currentPlayer = playerID;
      }
    }
  }
  return currentPlayer
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
function resolveWinner() {
  for (let playerID in gameStatePublic.players) {
    if (gameStatePublic.players[playerID].playing) {
      console.log('checking winning for '+playerID);
      checkWinner(gameStatePublic.players[playerID]);
    }
  }
}
function checkWinner (player) {
  if (player.score > 21) {
    player.winner = 'dealer';
  } else if (gameStatePublic.dealerScore > 21) {
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
function ServerEvery1Second() {
  if (!gameStatePublic.gameover) {
    let CurrentPlayer = getCurrentPlayer();
    //console.log("current player: "+CurrentPlayer);
  }
}