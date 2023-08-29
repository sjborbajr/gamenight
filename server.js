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
const app = express();
const server = http.createServer(app);
const io = new SocketIO(server);
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