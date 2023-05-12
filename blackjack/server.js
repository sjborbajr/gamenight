// Import required modules
const express = require('express'), http = require('http'), socketIO = require('socket.io'), fs = require('fs'), path = require('path');
//RateLimit = require('express-rate-limit'), 
// Set up the server
const app = express(), server = http.createServer(app), io = socketIO(server);
let joincount = 0, turnTimeout = null;//, limiter = RateLimit({windowMs: 500,max: 25});

// Start the server
const port = 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// apply rate limiter to all requests
//app.use(limiter);
//serv from the public folder
app.use(express.static(path.join(__dirname, 'public')));
//client.js is in root dir with server.js
app.get('/client.js', (req, res) => { res.set('Content-Type', 'text/javascript'); res.sendFile(path.join(__dirname, 'client.js')); });
//send public/index.html if no specific file is requested
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const gameStatePrivate = JSON.parse(fs.readFileSync('gameStatePrivate.json'));
const gameStatePublic = JSON.parse(fs.readFileSync('gameStatePublic.json'));
setInterval(ServerEvery1Second, (1*1000));

for (let playerID in gameStatePublic.players) {
  gameStatePublic.players[playerID].connected = false;
}

if (!gameStatePublic.gameover) {
  let currentPlayer = getCurrentPlayer();
  if (currentPlayer == null) {
    gameStatePublic.gameover = true;
  } else {
    console.log("set timeout for "+currentPlayer);
    turnTimeout = setTimeout(() => { handleInactivity(currentPlayer); }, ( 30 * 1000 ));
  }
}

io.on('connection', (socket) => {
  // Get the user id from handshake
  const userId = socket.handshake.auth.playerName;
  if (userId == "<dealer>"){
    socket.emit("error","invalid user");
    socket.disconnect();
  } else {
    console.log('User connected: '+userId);
    if ( !(gameStatePublic.players[userId])) {
      addPlayer(userId);
      
      // Start the game if this is the first player
      if (Object.keys(gameStatePublic.players).length === 1) {
        console.log('Starting a new game...');
        newDeck();
        gameStatePublic.players[userId].playing = true;
        dealHands();
        gameStatePublic.players[userId].turn = true;
      } else {
        socket.broadcast.emit('new player', userId);
        socket.emit('message', "game in progress, wait for next deal");
      }
    }
    gameStatePublic.players[userId].connected = true;
    sendState()
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
          gameStatePublic.players[userId].winner = "dealer";
          gameStatePublic.players[userId].turn = false;
          gameStatePublic.players[userId].played = true;
          
          let nextPlayer = getNextPlayer();
          console.log('Next Player '+nextPlayer);
          if (nextPlayer == null){
            gameStatePublic.gameover = true;
          } else if (nextPlayer == "<dealer>"){
            playDealer();
          } else {
            gameStatePublic.players[nextPlayer].turn = true;
          }
        }
        
        sendState();
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
        newDeck();
      }
      gameStatePublic.players[userId].playing = true;
      setTimeout(() => {
        dealHands();
        sendState();
      }, 250 );
    });
    socket.on('stand', () => {
      if (gameStatePublic.players[userId].turn == true) {
        console.log(userId+' is standing');
        gameStatePublic.players[userId].turn = false;
        gameStatePublic.players[userId].played = true;
        
        let nextPlayer = getNextPlayer();
        if (nextPlayer == "<dealer>"){
          playDealer();
        } else {
          gameStatePublic.players[nextPlayer].turn = true;
          sendState();
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
    });
    socket.on('Show Deck', () => {
      if (gameStatePublic.gameover){
        console.log('Show Deck requested by: '+userId);
        io.emit('Show Deck',gameStatePrivate.deck)
        newDeck();
      }
    });
  }
});
function sendState() {
  //cleare timer if there is one
  if (turnTimeout) {
    clearTimeout(turnTimeout);
    turnTimeout = null;
  }
  
  //send new game state to everyone
  io.emit('gameState', gameStatePublic);
  //save game state to disk
  fs.writeFileSync('gameStatePrivate.json', JSON.stringify(gameStatePrivate, null, 2));
  fs.writeFileSync('gameStatePublic.json', JSON.stringify(gameStatePublic, null, 2));


  if (!gameStatePublic.gameover) {
    //send state can be called from stand, need to get next player ID
    let currentPlayer = getCurrentPlayer();
    console.log("set timeout for "+currentPlayer);
    turnTimeout = setTimeout(() => { handleInactivity(currentPlayer); }, ( 30 * 1000 ));
  }
}
function playDealer() {
  if (turnTimeout) {
    clearTimeout(turnTimeout);
    turnTimeout = null;
  }
  //show the dealers hand
  gameStatePublic.dealerCards = gameStatePrivate.dealerCards;
  countcards(gameStatePublic.dealerCards[0]);
  io.emit('gameState', gameStatePublic);

  //play the dealers hand out
  let dealerScore = calculateScore(gameStatePublic.dealerCards);
  while (dealerScore < 17 ) {
    gameStatePublic.dealerCards.push(gameStatePrivate.deck.shift());
    countcards(gameStatePublic.dealerCards[gameStatePublic.dealerCards.length-1]);
    dealerScore = calculateScore(gameStatePublic.dealerCards);
  }
  gameStatePrivate.dealerCards = gameStatePublic.dealerCards;
  gameStatePublic.dealerScore = dealerScore;
  gameStatePublic.deckRemain = gameStatePrivate.deck.length;
  gameStatePublic.score = dealerScore;
  resolveWinner();
  gameStatePublic.gameover = true;
  fs.writeFileSync('gameStatePrivate.json', JSON.stringify(gameStatePrivate, null, 2));
  fs.writeFileSync('gameStatePublic.json', JSON.stringify(gameStatePublic, null, 2));

  //give a time so they can see the dealer card before playing the hand
  setTimeout(() => {
    io.emit('gameState', gameStatePublic);
  }, 250 );

}
function handleInactivity(userId) {
  clearTimeout(turnTimeout);
  turnTimeout = null;
  if (Object.values(gameStatePublic.players).filter((player) => player.connected).length > 1) {
    console.log("Slap "+userId)
    
    if (gameStatePublic.players[userId].connected){
      io.emit("slap",userId)
    }
    
    //take away users hand and remove them from play
    gameStatePublic.players[userId].hand = [];
    gameStatePublic.players[userId].playing = false;
    gameStatePublic.players[userId].turn = false;
    gameStatePublic.players[userId].played = true;
    gameStatePublic.players[userId].winner = "slapped";
    
    let nextPlayer = getNextPlayer();
    console.log("Slapped "+userId+" next player: "+nextPlayer)
    if (nextPlayer == "<dealer>"){
      playDealer()
    } else if (nextPlayer == null) {
      gameStatePublic.gameover = true;
    } else {
      console.log("next player is "+nextPlayer)
      gameStatePublic.players[nextPlayer].turn = true;
    }
    sendState()
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

  console.log('Dealt count player(s) and dealer a new hand');
  console.log('Deck Card Count: '+gameStatePrivate.deck.length);
  gameStatePublic.deckRemain = gameStatePrivate.deck.length;
  gameStatePublic.dealerScore = null;
  gameStatePublic.gameover = false;
  gameStatePublic.players[getNextPlayer()].turn = true;

}
function newDeck() {
  gameStatePublic.deckSize = Object.keys(gameStatePublic.players).length + 1;
  gameStatePrivate.deck = shuffleDeck(shuffleDeck(createDeck(gameStatePublic.deckSize)));
  gameStatePublic.cardcount = 0;
  fs.writeFileSync('deck.json', JSON.stringify(gameStatePrivate.deck, null, 2));

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
    if (gameStatePublic.players[playerID].score < 22 && gameStatePublic.players[playerID].playing == true) {
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
function createDeck(numDecks) {
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
  //console.log('Start shuffle '+deck.length+' cards.');
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    if (i > j){
      //console.log('i is '+i+' j is '+j+' Swap '+deck[j].image+' with '+deck[i].image);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    } else {
      //console.log('i is '+i+' j is '+j)
    }
  }
  console.log('Shuffled Deck with '+deck.length+' cards.');
  return deck
}
function countcards(card){
  if (card.value > 9) {
    gameStatePublic.cardcount--;
  } else if (card.value < 7) {
    gameStatePublic.cardcount++;
  }
  gameStatePublic.trueCount = (gameStatePublic.cardcount/(gameStatePublic.deckSize));
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
function calculateScore(hand) {
  let score = hand.reduce((sum, card) => sum + card.value, 0);
  let numAces = hand.filter((card) => card.rank === 'ace').length;
  while (numAces > 0 && score > 21) {
    score -= 10;
    numAces--;
  }
  return score;
}
function ServerEvery1Second() {
  if (!gameStatePublic.gameover) {
    //let CurrentPlayer = getCurrentPlayer();
    //console.log("current player: "+CurrentPlayer);
    //let PlayerCount = Object.values(gameStatePublic.players).filter((player) => player.playing).length;
    //console.log("player count: "+PlayerCount);
  }
}