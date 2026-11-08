window.OSCILLA_LIVE={LiveAPI:function(cb,path){var L=function(){return (window.OSCILLA_DEVICE||{}).live||{}},m=/cue_points (\d+)$/.exec(path||""),c=function(){return m?(L().cues||[])[+m[1]]:null};
this.id=(path==="live_set"||m)?1:0;this.type="";this.property="";
this.get=function(k){var q=c();if(q)return k==="name"?[q.name]:k==="time"?[q.beat]:[0];if(this.id&&!m&&k==="signature_numerator")return[L().sig||4];return[0]};
this.getcount=function(k){return this.id&&!m&&k==="cue_points"?(L().cues||[]).length:0};this.call=function(){}}};