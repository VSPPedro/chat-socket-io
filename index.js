// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);

// Para funcionar no Cloud9 (Comente codigo abaixo que é para funcionar localmente)
server.listen(process.env.PORT, process.env.IP, function(){
  console.log('listening on IP: ' + process.env.IP);
  console.log('listening on PORT: ' + process.env.PORT);
});

// Para funcionar localmente (Comente o codigo acima que é para funcionar na Cloud9)
/* 
var port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
}); 
*/

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

var numUsers = 0;
var clients = [];

io.on('connection', function (client) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  client.on('new message', function (data) {
    
    // Removendo o comando da mensagem
    data = data.replace('send -all ', '');
    
    // Concatenando no fim da mensagem a hora e a data
    data += getCurrentDateAndTime();
    
    // we tell the client to execute 'new message'
    io.emit('new message', {
      username: client.username,
      message: data
    });
  });
  
  // quando o cliente enviar 'new private message', isso escuta e executa
  client.on('new private message', function (data) {
    // Removendo o comando da mensagem
    data = data.replace('send -user ', '');
    
    // Pegando o nome do usuario
    var arr = data.split(' ');
    var privateUser = arr[0];
    var privateExist = false;
    data = '(private) ' + data.replace(privateUser, '') + getCurrentDateAndTime();
    
    // Iterando pelas conexões
    clients.forEach( function (clientSocket)
    {
        if (clientSocket.username == privateUser) {
          // Envia mensagem para o cliente atual
          clientSocket.emit('new message', {
            username: client.username,
            message: data
          });
          
          privateExist = true;
          
          return;
        }
    });
    
    if (privateExist) {
      // Envia mensagem para o cliente atual
      client.emit('new message', {
        username: client.username,
        message: data
      });
    } else {
      // Envia mensagem para o cliente atual
      client.emit('new message', {
        username: 'ChatBot',
        message: 'O usuário \"' + privateUser + '\" não existe ou não se encontra online no momento.' + getCurrentDateAndTime()
      });
    }
    
  });
  
  // when the client emits 'list', this listens and executes
  client.on('list', function () {
    
    // Removendo o comando da mensagem
    var mensaggem = 'Lista de usuários online: ';
    
    if (clients.length == 1) {
       mensaggem += clients[0].username + '.';
    } else {
      // Iterando pelas conexões
      clients.forEach( function (client)
      {
        if (client == clients[0]) {
          mensaggem += client.username
        } else if (client != clients[clients.length - 1]) {
            mensaggem += ', ' + client.username
        } else {
            mensaggem += ' e ' + client.username + '.'
        }
      });
    }
    
    // we tell the client to execute 'new message'
    client.emit('new message', {
      username: 'ChatBot',
      message: mensaggem
    });
  });
  
  // when the client emits 'rename', this listens and executes
  client.on('rename', function (data) {
    
    // we tell the client to execute 'stop typing'
    client.broadcast.emit('stop typing', {
      username: client.username
    });
    
    var oldName = client.username;
    
    // Pegando o nome do usuario
    var arr = data.split(' ');
    var newName = arr[1];
    var nameExits = false;
    
    // Iterando pelas conexões
    clients.forEach( function (client)
    {
      if (client.username == newName) {
        nameExits = true;
        return;
      } 
    });
    
    if (nameExits) {
      // we tell the client to execute 'new message'
      client.emit('new message', {
        username: 'ChatBot',
        message: 'O nome ' + newName + ' está em uso.'
      });
    } else {
      client.username = newName;
      // we tell the client to execute 'new message'
      client.emit('new message', {
        username: 'ChatBot',
        message: 'Renomeado com sucesso. Seu apelido atual é: ' + newName + '.'
      });
      //Enviando mensagem para todos os usuarios que ocorreu a mudança
      client.broadcast.emit('success rename', {
        oldName: oldName,
        newName: newName
      });
    }
  });
  
  // when the client emits 'unknown command', this listens and executes
  client.on('unknown command', function (data) {
    
    client.emit('new message', {
      username: 'ChatBot',
      message: 'O comando \"' + data + '\"' + ' não foi encontrado ou está incompleto. Abaixo segue a lista dos comandos - funcionalidades' 
    });
    
    client.emit('new message', {
      username: 'ChatBot',
      message: 'bye - sair do grupo'
    });
    
    client.emit('new message', {
      username: 'ChatBot',
      message: 'send -all <mensagem> - enviar mensagem ao grupo'
    });
    
    client.emit('new message', {
      username: 'ChatBot',
      message: 'send -user <nome_usuario> <mensagem> - enviar mensagem privada'
    });
    
    client.emit('new message', {
      username: 'ChatBot',
      message: 'list - visualizar participantes'
    });
    
    client.emit('new message', {
      username: 'ChatBot',
      message: 'rename <nome_nome> - renomear usuário'
    });
  });
  
  // when the client emits 'add user', this listens and executes
  client.on('add user', function (username) {
    if (addedUser) return;

    // we store the username in the socket session for this client
    client.username = username;
    ++numUsers;
    addedUser = true;
    
    // Armazenando nova conexão em um array
    clients.push(client); 
    
    // Tell the client to execute the method login
    client.emit('login', {
      numUsers: numUsers
    });
    
    // echo globally (all clients) that a person has connected
    client.broadcast.emit('user joined', {
      username: client.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  client.on('typing', function () {
    client.broadcast.emit('typing', {
      username: client.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  client.on('stop typing', function () {
    client.broadcast.emit('stop typing', {
      username: client.username
    });
  });

  // when the user disconnects.. perform this
  client.on('disconnect', function () {
    if (addedUser) {
      --numUsers;
      
      // Removendo cliente do array de sockets
      clients.splice(clients.indexOf(client), 1);
      
      // echo globally that this client has left
      client.broadcast.emit('user left', {
        username: client.username,
        numUsers: numUsers
      });
    }
  });
});

function getCurrentDateAndTime() {
    // Formatando mensagem
    var datetime = new Date();
    var day = datetime.getDate();
    // Retornar o mês, começa com 0 e vai até 11. O +1 é para corrigir o valor. 
    var month = datetime.getMonth() + 1;
    var year = datetime.getFullYear();
    var current_date = day + "/" + month + "/" + year;
    
    // Obtendo hora
    var hour = datetime.getHours();
    parseInt(hour) < 10 ? hour = "0" + hour : "";
    var min = datetime.getMinutes();
    parseInt(min) < 10 ? min = "0" + min : ""; 
    var current_time = hour + ":" + min;
    
    return " ~ " + current_time + " " + current_date
}
