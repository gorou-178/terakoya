
var ctx, color = "black";
var socket, localStream, peerConnection = undefined;
var CR = String.fromCharCode(13);

var localVideo = document.getElementById('local-video');
var remoteVideo = document.getElementById('remote-video');

function newCanvas(){
    var canvas = '<canvas id="canvas" width="345px" height="250px"></canvas>';
    $("#drawCanvas").html(canvas);
    ctx = document.getElementById("canvas").getContext("2d");
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    $("#canvas").drawTouch();
    $("#canvas").drawPointer();
    $("#canvas").drawMouse();
}

$.fn.drawTouch = function() {
    var start = function(e) {
        e = e.originalEvent;
        ctx.beginPath();
        x = e.changedTouches[0].pageX;
        y = e.changedTouches[0].pageY;
        ctx.moveTo(x,y);
    };
    var move = function(e) {
        e.preventDefault();
        e = e.originalEvent;
        x = e.changedTouches[0].pageX;
        y = e.changedTouches[0].pageY;
        ctx.lineTo(x,y);
        ctx.stroke();
    };
    $(this).on("touchstart", start);
    $(this).on("touchmove", move);
};

$.fn.drawPointer = function() {
    var start = function(e) {
        e = e.originalEvent;
        ctx.beginPath();
        x = e.pageX;
        y = e.pageY;
        ctx.moveTo(x,y);
    };
    var move = function(e) {
        e.preventDefault();
        e = e.originalEvent;
        x = e.pageX;
        y = e.pageY;
        ctx.lineTo(x,y);
        ctx.stroke();
    };
    $(this).on("MSPointerDown", start);
    $(this).on("MSPointerMove", move);
};

$.fn.drawMouse = function() {
    var clicked = 0;
    var start = function(e) {
        clicked = 1;
        ctx.beginPath();
        x = e.offsetX;
        y = e.offsetY;
        ctx.moveTo(x, y);
        socket.emit('message',{
            act: 'down',
            x: x,
            y: y,
            color: ctx.strokeStyle
        });
    };
    var move = function(e) {
        if(clicked){
            x = e.offsetX;
            y = e.offsetY;
            ctx.lineTo(x, y);
            ctx.stroke();
            socket.emit('message',{
                act: 'move',
                x: x,
                y: y
            });
        }
    };
    var stop = function(e) {
        clicked = 0;
    };
    $(this).on("mousedown", start);
    $(this).on("mousemove", move);
    $(window).on("mouseup", stop);
};

$(function(){

    var chat = new Vue({
        el: ".chat",
        data: {
            username: '',
            message: '',
            chats: []
        },
        created: function(){
            console.log('chatHistory created');
            this.username = 'ゲスト' + Math.floor(Math.random() * 100);
        },
        ready: function() {
            console.log('chatHistory ready');
        },
        methods: {
            addChat: function(message){
                var date = $.format.date(new Date().getTime(), 'yyyyMMddHHmmss');
                this.chats.unshift({name: this.username, message: message, date: date});
            },
            send: function(e) {
                e.preventDefault();
                if (!_.isEmpty(this.message)) {
                    this.addChat(this.message);
                    socket.emit('message',{
                        act: 'chat',
                        username: this.username,
                        message: this.message
                    });
                    this.reset();
                }
            },
            reset: function() {
                this.message = '';
            }
        }
    });

    var socketView = new Vue({
        el: '.live-video-box',
        template: '#live-video-tmpl',
        data: {
            socketReady: false,
            port: 5000,
            sendSdp: '',
            sendIce: '',
            receiveSdp: '',
            receiveIce: '',
            iceSeparator: '------ ICE Candidate -------',
            peerStarted: false,
            remote_down: false,
            timer: undefined,
            mediaConstraints: {
                'mandatory': {
                    'OfferToReceiveAudio':false,
                    'OfferToReceiveVideo':true
                }
            }
        },
        ready: function() {
            this.init();
        },
        methods: {
            onOpend: function(e) {
                console.log('socket opened');
                socketView.socketReady = true;
                socketView.startVideo();
            },
            onMessage: function(evt) {
                console.log('socket message');
                if (evt.type === 'offer') {
                    console.log("Received offer, set offer, sending answer....");
                    socketView.onOffer(evt);
                } else if (evt.type === 'answer' && socketView.peerStarted) {
                    console.log('Received answer, settinng answer SDP');
                    socketView.onAnswer(evt);
                } else if (evt.type === 'candidate' && socketView.peerStarted) {
                    console.log('Received ICE candidate...');
                    socketView.onCandidate(evt);
                } else if (evt.type === 'user dissconnected' && socketView.peerStarted) {
                    console.log("disconnected");
                    socketView.stop();
                } else {
                    switch (evt.act) {
                        case "down":
                            socketView.remote_down = true;
                            ctx.strokeStyle = evt.color;
                            ctx.beginPath();
                            ctx.moveTo(evt.x, evt.y);
                            break;
                        case "move":
                            console.log("remote: " + evt.x, evt.y);
                            ctx.lineTo(evt.x, evt.y);
                            ctx.stroke();
                            break;
                        case "up":
                            if (!socketView.remote_down) return;
                            ctx.lineTo(evt.x, evt.y);
                            ctx.stroke();
                            ctx.closePath();
                            socketView.remote_down = false;
                            break;
                        case "chat":
                            chat.addChat(evt.message);
                            break;
                        default:
                            console.log('このアクションはサポートしていません');
                    }
                }
            },

            init: function() {
                socket = io.connect('https://terakoya-signaling.herokuapp.com:' + this.port + '/');
                socket.on('connect', this.onOpend)
                      .on('message', this.onMessage);
            },

            onSDP: function(evt) {
                var evt = JSON.parse(this.receiveSdp);
                if (peerConnection) {
                    this.onAnswer(evt);
                }
                else {
                    this.onOffer(evt);
                }
                this.receiveSdp = "";
            },

            onICE: function() {
                var text = this.receiveIce;
                var arr = text.split(iceSeparator);
                for (var i = 1, len = arr.length; i < len; i++) {
                    var evt = JSON.parse(arr[i]);
                    this.onCandidate(evt);
                }
                this.receiveIce = "";
            },

            onOffer: function(evt) {
                console.log("Received offer...");
                console.log(evt);
                this.setOffer(evt);
                this.sendAnswer(evt);
                this.peerStarted = true;
            },

            onAnswer: function(evt) {
                console.log("Received Answer...");
                console.log(evt);
                this.setAnswer(evt);
            },

            onCandidate: function(evt) {
                var candidate = new RTCIceCandidate({sdpMLineIndex:evt.sdpMLineIndex, sdpMid:evt.sdpMid, candidate:evt.candidate});
                console.log("Received Candidate...");
                console.log(candidate);
                clearInterval(this.timer);
                peerConnection.addIceCandidate(candidate);
            },

            sendSDP: function(sdp) {
                var text = JSON.stringify(sdp);
                console.log("---sending sdp text ---");
                console.log(text);
                this.sendSdp = text;
                socket.json.send(sdp);
            },

            sendCandidate: function(candidate) {
                var text = JSON.stringify(candidate);
                console.log("---sending candidate text ---");
                console.log(text);
                this.sendIce = (this.sendIce + CR + this.iceSeparator + CR + text + CR);
                socket.json.send(candidate);
            },

            startVideo: function() {
                navigator.webkitGetUserMedia({video: true, audio: true},
                    function (stream) {
                        console.log('getUserMedia success');
                        localStream = stream;
                        localVideo.src = window.webkitURL.createObjectURL(stream);
                        localVideo.play();
                        localVideo.volume = 0;
                        socketView.tryConnect();
                    },
                    function (error) { // error
                        console.error('An error occurred: [CODE ' + error.code + ']');
                        return;
                    }
                );
            },

            tryConnect: function() {
                var that = this;
                this.timer = setInterval(function(){
                    that.connect();
                }, 5000);
            },

            stopVideo: function() {
                localVideo.src = "";
                localStream.stop();
            },

            prepareNewConnection: function() {
                var pc_config = {"iceServers":[]};
                var peer = null;
                try {
                    peer = new webkitRTCPeerConnection(pc_config);
                } catch (e) {
                    console.log("Failed to create peerConnection, exception: " + e.message);
                    return undefined;
                }

                var that = this;
                peer.onicecandidate = function (evt) {
                    if (evt.candidate) {
                        console.log(evt.candidate);
                        that.sendCandidate({type: "candidate",
                                sdpMLineIndex: evt.candidate.sdpMLineIndex,
                                sdpMid: evt.candidate.sdpMid,
                                candidate: evt.candidate.candidate}
                        );
                    } else {
                        console.log("End of candidates. ------------------- phase=" + evt.eventPhase);
                    }
                };

                console.log('Adding local stream...');
                peer.addStream(localStream);

                peer.addEventListener("addstream", this.onRemoteStreamAdded, false);
                peer.addEventListener("removestream", this.onRemoteStreamRemoved, false)

                return peer;
            },

            onRemoteStreamAdded: function(event) {
                console.log("Added remote stream");
                clearInterval(this.timer);
                remoteVideo.src = window.webkitURL.createObjectURL(event.stream);
            },

            // when remote removes a stream, remove it from the local video element
            onRemoteStreamRemoved: function(event) {
                console.log("Remove remote stream");
                remoteVideo.src = "";
            },

            sendOffer: function() {
                var that = this;
                peerConnection = this.prepareNewConnection();
                if (_.isUndefined(peerConnection)) {
                    console.log('prepareNewConnection fail');
                    return;
                }
                peerConnection.createOffer(function (sessionDescription) { // in case of success
                    peerConnection.setLocalDescription(sessionDescription);
                    console.log("Sending: SDP");
                    console.log(sessionDescription);
                    that.sendSDP(sessionDescription);
                }, function () { // in case of error
                    console.log("Create Offer failed");
                }, this.mediaConstraints);
            },

            setOffer: function(evt) {
                if (peerConnection) {
                    console.error('peerConnection alreay exist!');
                }
                peerConnection = this.prepareNewConnection();
                peerConnection.setRemoteDescription(new RTCSessionDescription(evt));
            },

            sendAnswer: function(evt) {
                console.log('sending Answer. Creating remote session description...' );
                if (! peerConnection) {
                    console.error('peerConnection NOT exist!');
                    return;
                }

                var that = this;
                peerConnection.createAnswer(function (sessionDescription) { // in case of success
                    peerConnection.setLocalDescription(sessionDescription);
                    console.log("Sending: SDP");
                    console.log(sessionDescription);
                    that.sendSDP(sessionDescription);
                }, function () { // in case of error
                    console.log("Create Answer failed");
                }, this.mediaConstraints);
            },

            setAnswer: function(evt) {
                if (! peerConnection) {
                    console.error('peerConnection NOT exist!');
                    return;
                }
                peerConnection.setRemoteDescription(new RTCSessionDescription(evt));
            },

            connect: function() {
                if (localStream && this.socketReady) { // **
                    //if (!peerStarted && localStream) { // --
                    this.sendOffer();
                    this.peerStarted = true;
                } else {
                    console.log('localStream error');
                }
            },

            // stop the connection upon user request
            hangUp: function() {
                console.log("Hang up.");
                this.stop();
            },

            stop: function() {
                peerConnection.close();
                peerConnection = null;
                this.peerStarted = false;
            }

        }
    });

    var toolbar = new Vue({
        el: ".toolbar",
        data: {
            palettes: [
                {color: 'black', active: true},
                {color: 'red', active: false},
                {color: 'green', active: false},
                {color: 'blue', active: false}
            ],
            brushs: [
                {sizeName: 'S', width: 3, active: true},
                {sizeName: 'M', width: 6, active: false},
                {sizeName: 'L', width: 9, active: false}
            ]
        },
        ready: function() {
            newCanvas();
            this.setColor(this.palettes[0]);
            this.setBrush(this.brushs[0]);
        },
        methods: {
            setColor: function(palette) {
                this.clearActivePalette();
                palette.active = true;
                ctx.beginPath();
                ctx.strokeStyle = palette.color;
            },
            setBrush: function(brush) {
                this.clearActiveBrush();
                brush.active = true;
                ctx.beginPath();
                ctx.lineWidth = brush.width;
            },
            clearActivePalette: function() {
                $.each(this.palettes, function(palette){
                    palette.active = false;
                });
            },
            clearActiveBrush: function() {
                $.each(this.brushs, function(brush){
                    brush.active = false;
                });
            }
        }
    });

});
