/**
   Set GOOGLE_APPLICATION_CREDENTIALS env var to Google Cloud service account key json file location.
*/

const Server = require("ws").Server;
const fsp = require("node:fs/promises");
const SpeechClient = require("@google-cloud/speech").v1p1beta1.SpeechClient;

const wss = new Server({ port: 8080 });

let out = null;

wss.on("connection", (ws) => {
  ws.on("message", async (raw) => {
    let message = JSON.parse(raw);
    switch (message.action) {
      case "start":
        out = await fsp.open("out.webm", "w")
        break;
      case "stop":
        await out.close();
        out = null;
        break;
      case "data":
        let buff = Buffer.from(message.data, "base64");
        await out.write(buff);
        break;
      case "transcribe":
        const content = await fsp.readFile("out.webm");
        const speech = new SpeechClient();
        const request = {
          config: {
            encoding: "WEBM_OPUS",
            audioChannelCount: 1,
            languageCode: "en-US",
            model: "medical_conversation",
            diarizationConfig: {
              enableSpeakerDiarization: true
            }
          },
          audio: {
            content
          }
        };
        speech.recognize(request)
              .then(res => {
                let transcript = "";
                if (res[0].results.length > 0) {
                  transcript = buildTranscript(res[0].results);
                }
                ws.send(JSON.stringify({action: "transcript", transcript}));
              })
              .catch(console.error);
        break;
    }
  });
});

function buildTranscript(results) {
  // TODO: Better result selection, as there is duplication in the last entry. Prob use segment end time to select/combine word sets.
  let words = results[results.length - 1].alternatives[0].words;
  let res = words.reduce((r, x) => {
    if (r.speaker === x.speakerTag) {
      if (x.word.length == 1 && x.word.match(/\W/)) {
        r.transcript = r.transcript + x.word;
      } else {
        r.transcript = r.transcript + " " + x.word;
      }
    } else {
      r.speaker = x.speakerTag;
      if (r.transcript.length > 0) {
        r.transcript = r.transcript + "\n\n";
      }
      // TODO: Alias speakers better as numbering is wonky.
      r.transcript = r.transcript + `speaker ${x.speakerTag}: ${x.word}`;
    }
    return r;
  }, { transcript: "", speaker: null });
  return res.transcript;
}
