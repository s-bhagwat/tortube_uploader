const OAuth2Data = require("./credentials.json");
const { google } = require("googleapis");
const express = require("express");
const path = require("path");
let WebTorrent = require("webtorrent-hybrid/index");
let client = new WebTorrent();

const app = express();

//handle the authentication
const CLIENT_ID = OAuth2Data.web.client_id;
const CLIENT_SECRET = OAuth2Data.web.client_secret;
const REDIRECT_URL = OAuth2Data.web.redirect_uris[0];

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URL
);

let name, pic;
let authed = false;
let scopes =
  "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/userinfo.profile";

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.get("/", (req, res) => {
  if (!authed) {
    //generate a auth url
    let url = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
    });
    res.render("index", { url: url });
  } else {
    //user is authenticated
    var oauth2 = google.oauth2({
      auth: oAuth2Client,
      version: "v2",
    });
    oauth2.userinfo.get((err, response) => {
      if (err) throw err;
      console.log(response.data);
      name = response.data.name;
      pic = response.data.picture;
      res.render("success", { name: name, pic: pic });
    });
  }
});

app.post("/upload", (req, res) => {
  //torrent downloading code
  const torrentUrl = req.body.magnet;
  console.log(torrentUrl);
  var videoTorrent = client.add(
    torrentUrl,
    { announce: ["wss://tracker.openwebtorrent.com"] },
    async (torrent) => {
      try {
        // Stream each file to the disk
        const files = torrent.files;
        let length = files.length;
        files.forEach(async (file) => {
          if (
            file.name.endsWith(".mp4") ||
            (file.name.endsWith(".mkv") && files[0].name === file.name)
          ) {
            console.log(file.name);
            const source = file.createReadStream();

            //youtube uploading code
            const youtube = google.youtube({
              version: "v3",
              auth: oAuth2Client,
            });

            youtube.videos.insert(
              {
                resource: {
                  // Video title and description
                  snippet: {
                    title: file.name,
                    description: "Uploaded From Youtube Uploader",
                  },

                  status: {
                    privacyStatus: "private",
                  },
                },
                // This is for the callback function
                part: "snippet,status",

                // Create the readable stream to upload the video
                media: {
                  body: source,
                },
              },
              (err, data) => {
                if (err) throw err;
                console.log(data);
                console.log("Done.");
                res.render("success", { name: name, pic: pic, success: true });
              }
            );
          }
        });
      } catch (err) {
        console.log(err);
      }
    }
  );
  videoTorrent.on("error", (err) => {
    console.log("torrent error", err);
  });
});

app.get("/google/callback", (req, res) => {
  //exchange code with access token

  const code = req.query.code;
  if (code) {
    oAuth2Client.getToken(code, (err, tokens) => {
      if (err) throw err;
      console.log("successfully authenticated");

      oAuth2Client.setCredentials(tokens);
      authed = true;
      res.redirect("/");
    });
  }
});

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`server is listening on ${port}`);
});
