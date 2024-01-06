const prompt = require("prompt-sync")({ sigint: true });
const { exec, execSync, spawn, spawnSync } = require("child_process");
const { SocksProxyAgent } = require("socks-proxy-agent");
let xmlParser = require("xml2json");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args)); //csm mode

let _token = null;
let tokenTime = null;

// Credits to https://github.com/fhuhne/CR-Unblocker for this server
const proxyHost = "cr-unblocker.us.to";
const proxyPort = 1080;
const proxyUsername = "crunblocker";
const proxyPassword = "crunblocker";

const agent = new SocksProxyAgent(
  `socks://${proxyUsername}:${proxyPassword}@${proxyHost}:${proxyPort}`
);

let getDataForTokenRequest = async () => {
  for (let i = 0; i < 2; i++) {
    try {
      let refreshToken = await fetch(
        "https://raw.githubusercontent.com/Samfun75/File-host/main/aniyomi/refreshToken.txt"
      );

      refreshToken =
        refreshToken?.statusText == "OK" ? await refreshToken.text() : "";

      refreshToken = refreshToken.replace(/[\n\r]/gi, "");
      const data = new URLSearchParams();
      data.append("grant_type", "refresh_token");
      data.append("refresh_token", refreshToken);
      data.append("scope", "offline_access");

      let resp = await fetch("https://beta-api.crunchyroll.com/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic a3ZvcGlzdXZ6Yy0teG96Y21kMXk6R21JSTExenVPVnRnTjdlSWZrSlpibzVuLTRHTlZ0cU8=",
        },
        agent,
        body: data.toString(),
      });
      resp = resp?.statusText == "OK" ? await resp.json() : {};
      return resp;
    } catch (error) {
      continue;
    }
  }
};

let getToken = async () => {
  let token = _token;
  let expired = token == null || tokenTime + 300000 <= Date.now();
  console.log({ expired });
  if (expired || token == null || typeof token === "undefined") {
    for (let id = 0; id < 2; id++) {
      try {
        let tokenData = await getDataForTokenRequest();
        let newToken = await fetch(
          "https://beta-api.crunchyroll.com/index/v2",
          {
            method: "GET",
            headers: {
              authorization: `${tokenData.token_type} ${tokenData.access_token}`,
            },
          }
        );
        newToken = newToken?.statusText == "OK" ? await newToken.text() : "";
        let allTokens = JSON.parse(newToken);
        allTokens["token"] = tokenData;
        _token = allTokens;

        tokenTime = Date.now();
        return allTokens;
      } catch (error) {
        continue;
      }
    }
  }
  return token;
};

let getMediaInfo = async (video_id, token) => {
  for (let i = 0; i < 2; i++) {
    try {
      let resp = await fetch(
        `https://beta-api.crunchyroll.com/content/v2/cms/objects/${video_id}?locale=en-US`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            authorization: `${token.token_type} ${token.access_token}`,
          },
        }
      );

      resp = resp.statusText == "OK" ? await resp.json() : "error";

      if (!resp || (typeof resp == "string" && resp.includes("error"))) {
        return null;
      }

      let json = resp;

      let lang = json.data[0].episode_metadata.subtitle_locales[0];
      if (json.data[0].episode_metadata.is_dubbed) {
        lang = json.data[0].episode_metadata.audio_locale;
      }
      return [json.data[0].episode_metadata.versions[0].media_guid, lang];
    } catch (error) {
      continue;
    }
  }
};

let getData = async (video_id) => {
  for (let i = 0; i < 2; i++) {
    let allTokens = await getToken();

    let mediaInfo = await getMediaInfo(video_id, allTokens.token);
    if (mediaInfo == null) {
      continue;
    }
    let mediaId = mediaInfo[0];
    let url = `https://beta-api.crunchyroll.com/cms/v2${allTokens.cms.bucket}/videos/${mediaId}/streams?Policy=${allTokens.cms.policy}&Signature=${allTokens.cms.signature}&Key-Pair-Id=${allTokens.cms.key_pair_id}&locale=fr-FR`;

    let response_media = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        authorization: `${allTokens.token.token_type} ${allTokens.token.access_token}`,
      },
    });

    response_media =
      response_media.statusText == "OK" ? await response_media.json() : "error";

    if (typeof resp == "string" && response_media.includes("error")) {
      continue;
    }

    return [response_media, mediaInfo[1]];
  }
};

let getDataForNewStreams = async (video_id) => {
  for (let i = 0; i < 2; i++) {
    let allTokens = await getToken();

    // let mediaInfo = await getMediaInfo(video_id, allTokens.token);
    // if (mediaInfo == null) {
    //   continue;
    // }

    // let mediaId = mediaInfo[0];
    // console.log(mediaId);
    let url = `https://cr-play-service.prd.crunchyrollsvc.com/v1/${video_id}/android/phone/play`;

    let response_media = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        authorization: `${allTokens.token.token_type} ${allTokens.token.access_token}`,
      },
    });

    // console.log(await response_media.text());

    response_media =
      response_media.statusText == "OK" ? await response_media.json() : "error";

    if (typeof response_media == "string" && response_media.includes("error")) {
      continue;
    }

    return response_media;
  }
};

let getManifestXML = async (url = "") => {
  if (!url) return "";
  //
  for (let i = 0; i < 2; i++) {
    let allTokens = await getToken();

    let response_media = await fetch(url, {
      method: "GET",
      headers: {
        // "Content-Type": "application/json",
        authorization: `${allTokens.token.token_type} ${allTokens.token.access_token}`,
      },
    });

    response_media =
      response_media.statusText == "OK" ? await response_media.text() : "error";

    if (typeof response_media == "string" && response_media.includes("error")) {
      continue;
    }

    return response_media;
  }
};

let parseManifestXMLtoJSON = async (xmlContent = "") => {
  if (!xmlContent) return {};

  let parsed = xmlParser.toJson(xmlContent);

  require("fs").writeFileSync("./test.json", JSON.stringify(parsed));
};

let search = async (searchTerm = "") => {
  let token = await getToken();

  if (token == null) {
    console.log("token null");
    return {};
  }

  for (let i = 0; i < 2; i++) {
    try {
      let api = `https://beta-api.crunchyroll.com/content/v2/discover/search?q=${searchTerm?.replace(
        /\s/g,
        "+"
      )}&n=20&type=series,top_results,movie_listing&preferred_audio_language=fr-FRS&locale=fr-FR`;
      //   )}&n=6&type=series,top_results,movie_listing&preferred_audio_language=en-US&locale=en-US`;

      let res = await fetch(api, {
        headers: {
          Authorization: `${token?.token?.token_type} ${token?.token?.access_token}`,
        },
      });
      if (res.status < 400) {
        let data = await res?.json();

        let topResults =
          data?.data?.find((el) => el["type"] == "top_results") ?? {};
        return "items" in topResults ? topResults["items"] : [];
      }
      return {};
    } catch (error) {
      continue;
    }

    return null;
  }
};

let getSeasons = async (id = "") => {
  let token = await getToken();

  if (token == null) {
    console.log("token null");
    return {};
  }

  let api = `https://beta-api.crunchyroll.com/content/v2/cms/series/${id?.trim()}/seasons?force_locale=&preferred_audio_language=fr-FR&locale=fr-FR`;

  // https://www.crunchyroll.com/content/v2/cms/seasons/GY5VEPZPY/episodes?preferred_audio_language=fr-FR&locale=en-US for episodes

  try {
    let res = await fetch(api, {
      headers: {
        Authorization: `${token?.token?.token_type} ${token?.token?.access_token}`,
      },
    });
    if (res.status < 400) {
      let data = await res?.json();
      if (!data || !data?.data) {
        return [];
      }
      return data?.data;
    }
    console.log(res?.statusText);
    return [];
  } catch (error) {
    console.log({ error });
  }
  return [];
};

let getEps = async (id = "") => {
  for (let i = 0; i < 2; i++) {
    try {
      let token = await getToken();

      if (token == null) {
        console.log("token null");
        return {};
      }

      let api = `https://beta-api.crunchyroll.com/content/v2/cms/seasons/${id?.trim()}/episodes?preferred_audio_language=fr-FR&locale=fr-FR`;

      let res = await fetch(api, {
        headers: {
          Authorization: `${token?.token?.token_type} ${token?.token?.access_token}`,
        },
      });
      if (res.status < 400) {
        let data = await res?.json();
        if (!data || !data?.data) {
          return [];
        }
        return data?.data;
      }
      console.log(res?.statusText);
      return [];
    } catch (error) {
      continue;
    }
  }
  return [];
};

(async () => {
  while (true) {
    let searchTerm = prompt("Search?: ");
    if (searchTerm == "q") {
      clear();
      break;
    }
    let results = await search(searchTerm);

    if (!results) {
      return;
    }

    clear();
    console.log(`Results for '${searchTerm}':\r`);

    while (true) {
      // clear();
      for (i in results) {
        console.log(
          `${(parseInt(i) ?? 0) + 1}. ${results[i]["title"]} - ${
            "series_metadata" in results[i] &&
            results[i]["series_metadata"]["is_dubbed"] == true
              ? "Doublé"
              : "Pas doublé"
          }`
        );
      }

      let animeChoice = prompt("Choice?: ");
      if (animeChoice == "q") {
        clear();
        break;
      }
      animeChoice = parseInt(animeChoice) ?? 1;

      if (animeChoice < 1 || animeChoice > results?.length) {
        console.log("You can't do that.");
        return;
      }
      animeChoice = animeChoice - 1;

      let animeChoiceData = results[animeChoice] ?? {};
      console.log(`Your choice: ${animeChoiceData["title"]}`);

      if (animeChoiceData["id"] == null || animeChoiceData["id"] == "") {
        clear();
        continue;
      }

      let seasons = await getSeasons(animeChoiceData["id"]);

      // console.log({ seasons });

      if (!seasons || seasons?.length == 0) {
        return;
      }

      //================================================

      while (true) {
        clear();
        for (i in seasons) {
          console.log(`${(parseInt(i) ?? 0) + 1}. ${seasons[i]["title"]}`);
        }

        let seasonChoice = prompt("Season?: ");
        if (seasonChoice == "q") {
          clear();
          break;
        }
        clear();
        seasonChoice = parseInt(seasonChoice) ?? 1;

        if (seasonChoice < 1 || seasonChoice > seasons?.length) {
          console.log("You can't do that.");
          return;
        }
        seasonChoice = seasonChoice - 1;

        let seasonChoiceData = seasons[seasonChoice] ?? {};
        console.log(`Your choice: ${seasonChoiceData["title"]}`);

        if (seasonChoiceData["id"] == null || seasonChoiceData["id"] == "") {
          clear();
          continue;
        }

        //================================================

        let eps = await getEps(seasonChoiceData["id"]);

        //================================================

        while (true) {
          clear();
          for (i in eps) {
            console.log(`${(parseInt(i) ?? 0) + 1}. ${eps[i]["title"]}`);
          }

          let epchoice = prompt("Ep?: ");
          if (epchoice == "q") {
            clear();
            console.log("shoud be breaking");
            break;
          }
          epchoice = parseInt(epchoice) ?? 1;

          if (epchoice < 1 || epchoice > eps?.length) {
            console.log("You can't do that.");
            return;
          }
          epchoice = epchoice - 1;

          let epChoiceData = eps[epchoice] ?? {};
          console.log(`Your ep: ${epChoiceData["title"]}`);

          if (epChoiceData["id"] == null || epChoiceData["id"] == "") {
            clear();
            continue;
          }

          //===================================================

          console.log("Getting data");

          let streams = [null, { streams: [] }];

          streams = await getData(epChoiceData["id"]);

          let manifestData = await getDataForNewStreams(epChoiceData["id"]);

          let manifest = await getManifestXML(manifestData?.url);
          let manifestJson = await parseManifestXMLtoJSON(manifest);
          //

          stop();

          // extradata = streams[1];
          // streams = streams[0];

          // let streamsUrls = [];

          // for (item in streams["streams"]) {
          //   streamsUrls = [
          //     ...streamsUrls,
          //     [...Object.values(streams["streams"][item])],
          //   ];
          // }

          // streamsUrls = streamsUrls?.reduce((sum, current) => {
          //   sum = sum.concat(current);
          //   return sum;
          // }, []);

          //================================================

          // while (true) {
          //   clear();
          //   for (i in streamsUrls) {
          //     if (
          //       streamsUrls[i]["hardsub_locale"] == "" ||
          //       streamsUrls[i]["hardsub_locale"].includes("fr-FR") ||
          //       streamsUrls[i]["hardsub_locale"].includes("en-US")
          //     ) {
          //       console.log(
          //         `${(parseInt(i) ?? 0) + 1}. ${epChoiceData["title"]}${
          //           "hardsub_locale" in streamsUrls[i] &&
          //           streamsUrls[i]["hardsub_locale"] != ""
          //             ? " - " + streamsUrls[i]["hardsub_locale"]
          //             : ""
          //         }${
          //           "url" in streamsUrls[i] &&
          //           (streamsUrls[i]["url"].includes(".m3u?") ||
          //             streamsUrls[i]["url"].includes(".m3u8?"))
          //             ? " - m3u8"
          //             : ""
          //         }`
          //       );
          //     }
          //   }

          //   let streamChoice = prompt("Source?: ");
          //   clear();
          //   if (streamChoice == "q") {
          //     break;
          //   }
          //   streamChoice = parseInt(streamChoice) ?? 1;

          //   if (streamChoice < 1 || streamChoice > streamsUrls?.length) {
          //     console.log("You can't do that.");
          //     return;
          //   }
          //   streamChoice = streamChoice - 1;

          //   let streamChoiceData = streamsUrls[streamChoice] ?? {};

          //   if (!streamChoiceData) {
          //     clear();
          //     break;
          //   }
          //   console.log(
          //     `Your choice: ${epChoiceData["title"]} - ${
          //       "hardsub_locale" in streamChoiceData
          //         ? streamChoiceData["hardsub_locale"]
          //         : ""
          //     }`
          //   );

          //   if (
          //     streamChoiceData["url"] == null ||
          //     streamChoiceData["url"] == ""
          //   ) {
          //     clear();
          //     continue;
          //   }

          //   try {
          //     await playWithMPV(
          //       streamChoiceData["url"],
          //       animeChoiceData["title"],
          //       seasonChoice,
          //       epchoice,
          //       epChoiceData["title"]
          //     );
          //   } catch (error) {
          //     console.log({ error });
          //     break;
          //   }
          // }
        }
      }
    }
  }
  //===================================================
})();

let playWithMPV = async (url = "", anime = "", s, e, title = "") => {
  if (!url || url == "") {
    return;
  }

  e = (parseInt(e) ?? 0) + 1;
  s = (parseInt(s) ?? 0) + 1;

  try {
    const mpv_play = execSync(
      `mpv --title='${anime} ${s}x${e} - ${title}' --profile=low-latency --referrer='https://www.crunchyroll.com' '${url}'`
    );

    console.log(`[MPV] Output: ${mpv_play.toString()}`);
    let wait = prompt("Enter to continue:::");
  } catch (error) {
    console.log({ error });
  }
};

let clear = () => {
  console.clear();
};

let stop = (entry = "Enter to continue...") => {
  return prompt(entry);
};

interceptSigInt = (cb = () => {}) => {
  if (process.platform === "win32") {
    var rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.on("SIGINT", function () {
      process.emit("SIGINT");
    });
  }

  process.on("SIGINT", function () {
    cb();
  });
};
