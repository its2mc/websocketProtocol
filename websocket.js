/* 
* This work has been done by Phillip Ochola Makanyengo
* Email: its2uraps@gmail.com
*
* This work uses open source code and libraries and 
* can therefore be replicated unless certain portions
* are stated otherwise. 
*
* Please refer to the author when using the code.
*
*/

//Modules
var http = require('http'),
net =  require('net'),
fs = require('fs'),
sys = require('sys'),
_ = require("underscore"),
circular = require('circular-json');

//Some constants
var PORT_VALUE = 443,
LOCALHOST = '127.0.0.1',
//OPCODES
CONT_OP = 0, //contination
TEXT_OP = 1, //text op code
BINARY_OP = 2, //binary op code
NON_CTRL_OP1 = 3, //non control opcode reserve1
NON_CTRL_OP2 = 4, //non control opcode reserve2
NON_CTRL_OP3 = 5, //non control opcode reserve3
NON_CTRL_OP4 = 6, //non control opcode reserve4
NON_CTRL_OP5 = 7, //non control opcode reserve5
CLOSE = 8, //used to signal close
PING = 9, //used to send ping
PONG = 10, //used for ping response
CTRL_OP1 = 11, //control opcode reserve1
CTRL_OP2 = 12, //control opcode reserve2
CTRL_OP3 = 13, //control opcode reserve3
CTRL_OP4 = 14, //control opcode reserve4
CTRL_OP5 = 15, //control opcode reserve5
CTRL_OP6 = 16, //control opcode reserve6

GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', // number used to make return key
host = '127.0.0.1',
accepted_protocols = ['chat','stream'];

//Needed variables

var message={
	_buf: [],
	continous_frame : 0,
	masking_key : 0,
	msg_len : 0,
	data_type : 0 //0 for text and 1 for binary
};


/*
//Global functions
*/

//Process request and handle connection establishement
var process_request = function(request,socket){ 
	var protocol_header;
	function fail(sock,e){ //function to safely fail
		sock.write("HTTP/1.1 403 Error occured\r\n");
		throw(e);
		if (sock) sock.close();
	}

	//check if requests or socket exists.
	if(!request||!socket) throw("No request/response/upgradeHead available");

	//console.log(circular.stringify(request)+'\n');
	console.log('Upgrading..\n');

	//Check if client origin is okay
	if (!(request.headers['origin']=="http://127.0.0.1:5050")) {
		//check for a source control condition and write back fail header
		fail(socket,"Origin not allowed")
	}

	// If protocol not specify will not specify in reply
	if (request.headers['sec-websocket-protocol'] == undefined)
		protocol_header = "";
	else
		protocol_header = "sec-websocket-protocol:"+accepted_protocols[0]+"\r\n";

	// check if websocket is okay
	if(!(request.headers['sec-websocket-version'] == 13)) fail(socket,"Version not compatible");

	// check what extensions are allowed
	//console.log(request.headers['sec-websocket-extensions']);

  	//Process key
	var secWsKey = request.headers['sec-websocket-key'];
	var hash =  require('crypto').createHash('SHA1').update(secWsKey+GUID).digest('base64');

	//Write header with reply
	socket.write("HTTP/1.1 101 Web Socket Protocol Handshake\r\n"
		+ "upgrade: websocket\r\n"
		+ "connection: upgrade\r\n"
		+ "sec-websocket-accept: "+hash+"\r\n"
		+ protocol_header
		+ "webSocket-origin: http://"+LOCALHOST+":"+PORT_VALUE+"\r\n"
		+ "webSocket-location: ws://"+LOCALHOST+":"+PORT_VALUE+"\r\n"
		+ "\r\n"
	);

	console.log('Socket Connection Established\n');
	return 1;
}

//function to make it easier to handle message logic
var msg_identifier = function(buffer){  
	var len_var;
	//check payload length and give output
	//So this part may seem hard but its really not.. The buffer that is coming in
	//is in the form of a UIntArray(8) basically each element in the array is 1 byte
	//or 8 bits. If I want to read the message, I need to handle bits.. but javascript
	//does not expose this to me. So I use & and >> to access the bits. & is AND .. kinda
	//like multiplication and >> shifts the bytes to the right. so for each byte, I use & 
	//to negate bit locations I dnt want and then shift the bit I want to position 1
	//The outcome is therefore either 1 or 0 . i.e.. 00000001 or 00000000
	proto = {
		fin : (buffer[0] & 128)>>7, 
		rsv1 : (buffer[0] & 64)>>6,
		rsv2 : (buffer[0] & 32)>>5,
		rsv3 : (buffer[0] & 16)>>4,
		opcode : (buffer[0] & 15),//This simply negates bits from pos 4~7 leaving us with the number we want.
		mask : (buffer[1] & 128)>>7 , //Its in an awkward position but anyhu
		//had totally forgotten about masking
		masking_key : 0, 
		payload_len_min : (parseInt(buffer[1] & 127)), //decided to add this after unforseen consequences.. :(
		//if mask is 1 then have to shift over.. if not then remove pos of mask and value will be size
		//might be better to calculate the full payload length here
		payload_len_max : 0
	};
	//moved these outside..
	proto.masking_key = (proto.mask == 1)?buffer.slice(2,6):0;

	if (proto.mask == 0) {
		//if mask not set means that index 1 contains payload length and following indices contain payload_len/payload
		// if less than 126 then that is the message length
		if ((buffer[1] & 127) < 126)len_var = parseInt(buffer[1] & 127); 
		// if exactly 126 then look into next 16 bits (2 bytes) in pos 2 and 3
		else if((buffer[1] & 127) == 126) len_var = parseInt(buffer.slice(2,4));
		// if 127 then next 64 bits needed. (8 bytes) in pos 2,3,4,5,6,7,8,9
		else if((buffer[1] & 127) > 126) len_var = parseInt(buffer.slice(2,10));
	}
	else {
		//if masking key is set . it means masking key is in pos 2,3,4,5 of buffer and payload extension is from pos 6
		// if less than 126 then that is the message length. this remains as before
		if ((buffer[1] & 127) < 126)len_var = parseInt(buffer[1] & 127); 
		// if exactly 126 then look into next 16 bits (2 bytes) in pos 6 and 7
		else if((buffer[1] & 127) == 126) len_var = parseInt(buffer.slice(6,8));
		// if 127 then next 64 bits needed. (8 bytes) in pos 6,7,8,9,10,11,12,13
		else if((buffer[1] & 127) > 126) len_var = parseInt(buffer.slice(6,14));
	}
	proto.payload_len_max = len_var;

	len_var = 0;// set to 0 just in case
	return proto;
}

//This function uses the mask to unmask the message before being returned
var unmask_msg = function(mask,key,msg){
	var j = 0,
	new_msg = new Buffer(msg);
	if (mask == 0) return msg; // we check if message has been masked. if not then leave
	else{
		//Here we implement masking algorithm and return a clean message
		for (var i = 0;i<msg.length;i++){
			j = i%4;
			new_msg[i] = msg[i] ^key[j];
		}
		return new_msg;
	}
};

//Process raw messages recieved
var process_message = function(identifier,payload,socket){
	var n1,n2,n3; //starting positions for message payload. Testing.

	//Check to see if continous frame. if so then just write new message 
	if(message.continous_frame == 1){
		message.msg_len -= 2^((payload.length*8)-1); //subtract current message length
		//check if expected length of message exhausted
		if(message.msg_len < 1){ // if so then message ended
			message._buf.concat(payload); //directly append message to buffer
			message.continous_frame = 0; //switch off continous frame
		}
		else{ // if not then message still continues 
			message._buf.concat(payload); // concat full message and continue
			message.continous_frame = 1;
			return "continuous_frame"; //inform user that frame is continous
		}

		//Little routine to unmask full buffer here. as long as continous frames have same masks
		message._buf = unmask_msg(message.mask,message.masking_key,message._buf);

		//Now I try to get the data type and send the message back to the user
		if(message.data_type == 0) //default datatype is text
			return message._buf.toString('utf8'); //send text data
		else
			return message._buf; //send raw byte data

		//so I used a binary trick to extract the message from the fin bit in payload[0]
		//message = payload & ( ~( 2^( payload.length*8-1))); //Overly complex.. I feel it can be simplified..
	}else{
		message._buf = []; //reset message buffer
		message.msg_len = 0; //might decide to dynamically load the message object as new buffer
		message.continous_frame = 0;
		message.data_type = 0; //default is 0 i.e. text
		message.masking_key = (identifier.mask==1)?identifier.masking_key:0;
		//~ is bitwise not, since if fin is 0 then frame is 1 and opposite is true too
		message.continous_frame = (identifier.fin==1)?0:1; //sets first frame to be processed as normal
		
		//So now I check the message type
		switch(identifier.opcode){
			case CONT_OP://will set this to 0 for now.. it looks to be reduntant with fin already
				continous_frame = 0;
			break;
			case TEXT_OP://text op code will focus on this for now
				message.data_type = 0;
			break; 
			case BINARY_OP: //binary op code will try this next
				message.data_type = 1;
			break;
			case PING: //used to send ping
				pong();
			break;
			default:
				return "Message opcode not okay"; 
			break;
		}

		//This small function sets the starting position of the message payloads.. its getting hard to keep track
		if(identifier.mask == 1){
			n1=6;n2=8;n3=14; 
		}else{
			n1=2;n2=4;n3=10;
		}

		if(message.continous_frame == 0){//if message not continous then get message and return to user
			//Now I try and get the message size and copy message
			message.msg_len = identifier.payload_len_max; //max is the absolute message size, min is pos 3 to int
			if (identifier.payload_len_min <126){ // if less than 126 then that is the message length
				//message._buf.concat(payload.slice(n1,(payload.length))); //copy whole message
				message._buf = payload.slice(n1,payload.length);
			}
			else if(identifier.payload_len_min == 126){// if exactly 126 then look into next 16 bits (2 bytes)
				message._buf = payload.slice(n2,(payload.length)); //concatinate message to buffer
				message.msg_len -=  2^((payload.length-n2)*8-1); //reduce the length of message copied
			}
			else if(identifier.payload_len_min > 126){// if 127 then next 64 bits needed. (8 bytes)
				message._buf = payload.slice(n3,(payload.length)); //concatinate message to buffer
				message.msg_len -=  2^((payload.length-n3)*8-1); //reduce the length of message copied
			}

			//Little routine to unmask full buffer here. as long as continous frames have same masks
			message._buf = unmask_msg(message.mask,message.masking_key,message._buf);

			//Now I try to get the data type and send the message back to the user 
			if(message.data_type == 0) //default datatype is text
				return message._buf.toString('utf8'); //send text data
			else
				return message._buf; //send raw data
		}else{//if continous then append to buffer and return continous
			//Now I try and get the message size and copy message
			message.msg_len = identifier.payload_len_max;
			if (identifier.payload_len_min <126){ // if less than 126 then that is the message length
				message.msg_len = identifier.payload_len_max; 
				message._buf.concat(payload.slice(n1,(payload.length))); //copy whole message
			}
			else if(identifier.payload_len_min == 126){// if exactly 126 then look into next 16 bits (2 bytes)
				message._buf.concat(payload.slice(n2,(payload.length))); //concatinate message to buffer
				message.msg_len -=  2^((payload.length-n2)*8-1); //reduce the length of message copied
			}
			else if(identifier.payload_len_min > 126){// if 127 then next 64 bits needed. (8 bytes)
				message._buf.concat(payload.slice(n3,(payload.length))); //concatinate message to buffer
				message.msg_len -=  2^((payload.length-n3)*8-1); //reduce the length of message copied
			}
			return "continuous_frame"; //not needed but good for debugging
		}
	}
}

//Process messages and send to client wow.. didnt think about this.. :D 
var send_message = function(message,socket){

}

//Pong message to client
var pong = function(){
	console.log("Recieved Ping");
}
//Handle chat options. I plan to use reserve op codes to implement
//WIll use reserve ops codes

//Process chat messages. I plan to use reserved op codes to implement 
//A custom chat app that uses websocket protocol.
//var process_request
	
function createTestServer(){
	return new testServer();
};


function testServer(){
	var server = this;

	http.Server.call(server,function(){});
	
	server.addListener("connection",function(req,res){
		console.log('Connected to HTTP Server.\n Waiting for upgrade request\n');
	});
	
	server.addListener("request" , function(req,res){
		console.log('Request recieved!\n');
		res.writeHead(200, {"Content-Type":"text/plain"});
		res.write("HTTP SERVER WORKING");
		res.end();
	});
	
	server.addListener("end" , function(req,res){
		console.log('Connected Ended!!:\n');
	});
	
	server.addListener("upgrade", function (req,socket,upgradeHead){
		var rv = 0;
		try{
			rv = process_request(req,socket); 
			if(rv ==1){//if request handled properly
				socket.on('data', function(d,start,end){
					//Get message identifier (makes it easier to handle messages)
					var ident = msg_identifier(d.slice(0,13)); //input only first part of data slice function needs limit of n-1
					//console.log(JSON.stringify(ident)); //good for debugging purposes 
					console.log(process_message(ident,d,socket)); //the return value will be buffer with message
				});
				socket.on('close',function(e){
					console.log("connection closed!\n"+e.toString());
				});
			}
			else{
				console.log("Connection failed, unhandled error");
			}
		} 
		catch (e){
			console.log('Connection error\n'+e);
		}		 
	});
}

sys.inherits(testServer,http.Server);


//Start the application
var server = createTestServer();
server.listen(PORT_VALUE);


