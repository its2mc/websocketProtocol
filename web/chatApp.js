var readMsg = function (msg){
	var temp = JSON.parse(msg);
	return temp;
};

var wsUri = "ws://localhost:443";
websocket = new WebSocket(wsUri);

$(document).ready(function(){

	$("vidApp").attr("disabled:disabled");
	$("#join").click(function(){ 
		$("#board").html("Connecting to Websocket Server</br>");

	});
	
	websocket.onopen = function(evt) { 
		$("#board").html("Connected to Websocket Server</br>");
	}; 
	
	websocket.onclose = function(evt) { 
		$("#board").html("Connection to Websocket closed</br>");
	}; 
	
	websocket.onmessage = function(evt) { 
		var temp = readMsg(evt.data);
		if(temp.command){
			if(temp.command==="newUser") alert(temp.userIP)
			else $("#board").append(temp.id +">>>"+temp.msg+"</br>");
			
		}else{
			$("#board").append("Error!</br>");
		}
	}; 
	
	websocket.onerror = function(evt) { 
		$("#board").append("<p>Error:"+evt.data+"</p>");
	}; 

	$("#board").html("Chat app is starting.");
	
	$("#quit").click(function(){
		$("#board").html("Quiting from server</br>");
		websocket.close(); 	
	});
	
	$("#sendToClient").click(function(){
		var msg = $("#msg").val();
		$("#board").append("You >>>"+msg+"</br>");
		var to = "127.0.0.1";
		var temp = '{"command": "sendToClient","msg":"'+msg+'","to":"'+to+'","id":""}';
		websocket.send(temp);	
	});
	
	$("#sendToAll").click(function(){
		var msg = $("#msg").val();	
		$("#board").append("You >>>"+msg+"</br>");
		var temp = '{"command": "sendToAll", "msg":"'+msg+'","id":""}';
		websocket.send(temp);	
	});
});

