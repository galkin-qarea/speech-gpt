window.onload = () => { (function (w, d, n) {
  const reader = new FileReader();
  const ws = new WebSocket("wss://www.local/speech-gpt/ws");
  let recorder = null, audioCtx = null;

  ws.onopen = () => console.log("ws open");
  ws.onclose = () => console.log("ws close");
  ws.onerror = console.error;
  ws.onmessage = (event) => {
    let message = JSON.parse(event.data);
    switch (message.action) {
      case "transcript":
        let ta = d.getElementById("transcript");
        ta.placeholder = "";
        ta.value = message.transcript;
        break;
    }
  };

  function toggleRecording() {
    if (recorder === null) {
      n.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false })
       .then(stream => {
         audioCtx = new AudioContext({ sampleRate: 24000 }); // use AC to resample to Opus compatible sample rate

         const src = audioCtx.createMediaStreamSource(stream);
         const dst = new MediaStreamAudioDestinationNode(audioCtx, { channelCount: 1, channelCountMode: "explicit" });

         const srcChannels = stream.getAudioTracks()[0].getSettings().channelCount;
         if (srcChannels > 1) { // downmix channels to mono
           const merger = audioCtx.createChannelMerger(srcChannels);
           src.connect(merger);
           merger.connect(dst);
         } else {
           src.connect(dst);
         }

         recorder = new MediaRecorder(dst.stream, {
           mimeType: 'audio/webm;codecs="opus"'
         });

         recorder.ondataavailable = async (event) => {
           reader.readAsDataURL(event.data);
           reader.onloadend = () => {
             let data = reader.result;
             data = data.substring(data.indexOf(",") + 1);
             ws.send(JSON.stringify({ action: "data", data: data }));
             if (recorder === null) {
               ws.send(JSON.stringify({ action: "stop" }));
             }
           };
         };

         recorder.onstart = () => {
           d.getElementById("record").innerText = "Stop";
           ws.send(JSON.stringify({action: "start"}));
         };

         recorder.onstop = () => {
           console.log("stop");
           d.getElementById("record").innerText = "Record";
           stream.getAudioTracks()[0].stop();
           recorder = null;
         };

         recorder.start(1000);
         console.log("start");
       })
       .catch(console.error);
    } else {
      recorder.stop();
    }
  }

  function transcribe() {
    let ta = d.getElementById("transcript");
    ta.value = "";
    ta.placeholder = "Transcribing...";
    ws.send(JSON.stringify({ action: "transcribe" }));
  }

  const recBtn = d.getElementById("record");
  recBtn.onclick = toggleRecording;

  const sttBtn = d.getElementById("transcribe");
  sttBtn.onclick = transcribe;
})(window, document, navigator) };
