/*! (c) 2026 attic rain. All rights reserved. */
(function(){var id=new URLSearchParams(location.search).get("id")||"",m=document.getElementById("msg");
function say(t){m.textContent=t;m.className="msg err";m.hidden=false}
if(!/^[A-Za-z0-9]{10}$/.test(id)){say("This report link is not complete. Check that the whole link was copied.");return}
window.OSCILLA_SHARE=1;
window.OSCILLA_REPORT.link(id,function(e){if(e&&e.old){location.replace("v1.html?id="+id);return}
var t=String(e&&e.message);say(t==="404"?"This report could not be found.":"The report could not be opened. Check your connection and try again.")});
var r=document.getElementById("report");new MutationObserver(function(){if(!r.hidden)m.hidden=true}).observe(r,{attributes:true,attributeFilter:["hidden"]});
})();