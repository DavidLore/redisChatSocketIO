var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var creds = '';
var redis = require('redis');
var client = '';
var port = process.env.PORT || 8080;

var path    = require("path");
app.use(express.static(__dirname + '/views'));
//Store all HTML files in view folder.
app.use(express.static(__dirname + '/public/js'));
app.use(express.static(__dirname + '/public/css'));
//Store all JS and CSS in Scripts folder.

// Express Middleware for serving static
// files and parsing the request body
app.use(express.static('public'));
app.use(bodyParser.urlencoded({
    extended: true
}));
// Start the Server
http.listen(port, function() {
    console.log('Server Started. Listening on *:' + port);
});
// Store people in chatroom
var chatters = [];
// Store messages in chatroom
var chat_messages = [];

// Read credentials from JSON
fs.readFile('creds.json', 'utf-8', function(err, data) {
    if(err) throw err;
    creds = JSON.parse(data);
    client = redis.createClient('redis://' + creds.user + ':' + creds.password + '@' + creds.host + ':' + creds.port);
    // Redis Client Ready
    client.once('ready', function() {
        // Flush Redis DB
        // client.flushdb();
        // Initialize Chatters
        client.get('chat_users', function(err, reply) {
            if (reply) {
                chatters = JSON.parse(reply);
            }
        });
        // Initialize Messages
        client.get('chat_app_messages', function(err, reply) {
            if (reply) {
                chat_messages = JSON.parse(reply);
            }
        });
    });
});

// API - Join Chat
app.post('/join', function(req, res) {
    var username = req.body.username;
    if (chatters.indexOf(username) === -1) {
        chatters.push(username);
        client.set('chat_users', JSON.stringify(chatters));
        res.send({
            'chatters': chatters,
            'status': 'OK'
        });
    } else {
        res.send({
            'status': 'FAILED'
        });
    }
});

app.post('/leave', function(req, res) {
    var username = req.body.username;
    chatters.splice(chatters.indexOf(username), 1);
    client.set('chat_users', JSON.stringify(chatters));
    res.send({
        'status': 'OK'
    });
});

// API - Send + Store Message
app.post('/send_message', function(req, res) {
    var username = req.body.username;
    var message = req.body.message;
    chat_messages.push({
        'sender': username,
        'message': message
    });
    client.set('chat_app_messages', JSON.stringify(chat_messages));
    res.send({
        'status': 'OK'
    });
});

// API - Get Messages
app.get('/get_messages', function(req, res) {
    res.send(chat_messages);
});

// API - Get Chatters
app.get('/get_chatters', function(req, res) {
    res.send(chatters);
});

// Socket Connection
// UI Stuff
io.on('connection', function(socket) {
    // Fire 'send' event for updating Message list in UI
    socket.on('message', function(data) {
        io.emit('send', data);
    });
    // Fire 'count_chatters' for updating Chatter Count in UI
    socket.on('update_chatter_count', function(data) {
        io.emit('count_chatters', data);
    });
});

app.get('/',function(req,res){
  res.sendFile(path.join(__dirname+'/views/index.html'));
  //It will find and locate index.html from View or Scripts
});