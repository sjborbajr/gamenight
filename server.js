// Import required modules
import express from 'express';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'crypto';

const mongoUri = process.env.MONGODB || "mongodb://localhost/?retryWrites=true";
const client = new MongoClient(mongoUri);
try {
  await client.connect();
} catch (error) {
  console.error('Error connecting to MongoDB:', error);
}
const database = client.db('gamenight');
const settingsCollection = database.collection('settings'), gameDataCollection = database.collection('gameData');

// Set up the app/web/io server
const app = express(), server = http.createServer(app), io = new SocketIO(server);
const __filename = fileURLToPath(import.meta.url), __dirname = dirname(__filename);

// Start the web server
server.listen(process.env.PORT || 4000);

//configure the web server, serv from the public folder
app.use(express.static(join(__dirname, 'public')));
//client.js is in root dir with server.js
app.get('/client.js', (req, res) => { res.set('Content-Type', 'text/javascript'); res.sendFile(join(__dirname, 'client.js')); });
//send public/index.html if no specific file is requested
app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));

gameDataCollection.updateMany({type:'player'},{$set:{connected:false}});

io.on('connection', async (socket) => {
  // Get the user id, auth token and IP from handshake
  let playerName = socket.handshake.auth.playerName || '', clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address.address, authNonce = socket.handshake.auth.authNonce || '';
  playerName = playerName.trim().replace(/[^a-zA-Z0-9]/g,'');
  console.log('['+new Date().toUTCString()+'] User connected: '+playerName+' From: '+clientIp);

  let playerData = await fetchPlayerData(playerName)
  if ( playerData ) {
    //Valid Player, let make sure it is really them
    if (playerData.name == playerName && playerData.authNonce == authNonce && authNonce != '') {
      console.log('['+new Date().toUTCString()+'] player had his nonce');
      //need to ratate nonce, need to store browser id string, need to allow multiple browser ids, actually make it a nonce not a cookie
    } else if (playerData.authNonce != authNonce && playerData.name == playerName && playerData.ipList.includes(clientIp)) {
      console.log('['+new Date().toUTCString()+'] player had the right IP but not the nonce, giving him one');
      //need to ratate nonce, need to store browser id string, need to allow multiple browser ids, actually make it a nonce not a cookie
      socket.emit('nonce',playerData.authNonce);
    } else {
      socket.emit("error","user not authenticated");
      socket.disconnect();
      console.log('['+new Date().toUTCString()+'] player '+playerName+' did not have nonce and did not have IP - Kicked');
    }
  } else {
    playerData = await addPlayer(playerName,socket,clientIp);
    if (!playerData) {
      socket.emit("error",'['+new Date().toUTCString()+'] Could not add user with name "'+playerName+'"');
      socket.disconnect();
    }
  }

  gameDataCollection.updateOne({type:'player',name:playerName},{$set:{connected:true}});

  //emit to friends that playerName is online

  //emit all games currently in, join channels



  socket.on('createGame', async data => {
    console.log('['+new Date().toUTCString()+'] User '+playerName+' is starting a game of '+data.gameName)
    //validate the user does not currently have an active game

    //create game, emit game, join channel
    
  });

  socket.on('joinGame', async data => {
    //validate data.gameId is forming or game type allow a person to join 
    console.log('['+new Date().toUTCString()+'] User '+playerName+' wants to join game '+data.gameId)
    //validate there is space for this game type or ask members if table is full (add to friends list)
  });

  socket.on('addComputerPlayer', async data => {
    //validate data.gameId is forming
    console.log('['+new Date().toUTCString()+'] User '+playerName+' wants to join game '+data.gameId)
    //validate there is space for this game type
  });

  socket.on('bootPlayer', async data => {
    //validate data.gameId is forming or allows in game boot
    //validate role is admin or player owns game
    console.log('['+new Date().toUTCString()+'] User '+playerName+' wants to boot '+data.otherPlayerName+' from game '+data.gameId)
  });

  socket.on('startGame', async data => {
    //validate data.gameId is forming
    //validate role is admin or player owns game
    console.log('['+new Date().toUTCString()+'] User '+playerName+' wants to start game '+data.gameId)
    //validate the right number of players for this game type
    //add players to players freinds lists
    //deal
  });

  socket.on('endGame', async data => {
    //validate data.gameId is running
    //validate role is admin or player owns game
    console.log('['+new Date().toUTCString()+'] User '+playerName+' wants to end game '+data.gameId)
    //end game, teardown channel
  });

  socket.on('getRules', async data => {
    console.log('['+new Date().toUTCString()+'] User '+playerName+' wants rules for '+data.gameName)
  });

  socket.on('removeFriend', async data => {
    console.log('['+new Date().toUTCString()+'] User '+playerName+' wants to remove friend '+data.playerId)
  });

  

  //Generic system below
  if (playerData.admin){
    socket.emit('serverRole','admin')
  }
  socket.onAny((event, ...args) => {
    // Log all recieved events/data except settings save
    if (event != 'something'){
      console.log('['+new Date().toUTCString()+'] playerName('+playerName+'), socket('+event+')', args);
    }
  });
  socket.on('changeName', async newName => {
    if (newName == newName.trim().replace(/[^a-zA-Z0-9]/g,'')){
      console.log('Player changing name from '+playerName+' to '+newName);
      let test = await fetchPlayerData(newName)
      //console.log(test)
      if (test) {
        socket.emit("error","player name already taken");
      } else {
        let rc = await updatePlayer(playerName,{$set:{name:newName}})
        if (rc == 'success') {
          socket.emit("nameChanged",newName);
          playerName = newName;
          playerData.name = playerName;
        } else {
          socket.emit("error","error changing name");
        }
      }
    } else {
      let message = {message:'New name appeared to have invalid chars, not changing!',color:'red',timeout:5000}
      socket.emit('alertMsg',message);      
    }
  });
  socket.on('disconnect', () => {
    console.log('['+new Date().toUTCString()+'] Player disconnected:', playerName);
    //emit to friends playerName went offline
    gameDataCollection.updateOne({type:'player',name:playerName},{$set:{connected:false}});
  });
});
async function fetchPlayerData(playerName) {
  let findFilter = {name:playerName,type:'player'};
  try {
    let playerData = await gameDataCollection.findOne(findFilter);
    return playerData;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
async function addPlayer(playerName,socket,clientIp) {
  if (playerName.length > 0){
    console.log('adding user: '+playerName);
    let nonce = crypto.randomBytes(64).toString('base64');
    socket.emit('nonce',nonce)
    let playerDoc = {
      name: playerName,
      type: 'player',
      ipList: [ clientIp ],
      authNonce: nonce
    }
    try {
      await gameDataCollection.insertOne(playerDoc,{safe: true});
      return playerDoc
    } catch (error){
      console.error('Error saving response to MongoDB:', error);
    }
  }
}
async function updatePlayer(playerName,update) {
  try {
    await gameDataCollection.updateOne({type:'player',name:playerName},update);
    return 'success'
  } catch (error){
    console.error('Error saving response to MongoDB:', error);
  }
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