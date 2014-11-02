
$(function(){
    console.log('\'Allo \'Allo!');

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
                    this.reset();
                }
            },
            reset: function() {
                this.message = '';
            }
        }
    });

    var liveCanvas = new Vue({
        el: "#drawCanvas",
        data: {
            ctx: undefined,
            x: 0,
            y: 0,
            isStart: false
        },
        template: '#liveCanvas',
        created: function() {

        },
        ready: function() {
            //this.ctx = document.getElementById("canvas").getContext("2d");
            //this.ctx.strokeStyle = '#000';
            //this.ctx.lineWidth = 5;
        },
        methods: {
            start: function(e) {
                console.log('start');
                this.isStart = true;
                this.ctx.beginPath();
                this.x = e.pageX;
                this.y = e.pageY;
                this.ctx.moveTo(this.x, this.y);
            },
            end: function(e) {
                console.log('end');
                this.isStart = false;
            },
            move: function(e) {
                if (this.isStart) {
                    console.log('move');
                    this.x = e.pageX;
                    this.y = e.pageY;
                    this.ctx.lineTo(this.x, this.y);
                    this.ctx.stroke();
                }
            }
        }
    });

});
