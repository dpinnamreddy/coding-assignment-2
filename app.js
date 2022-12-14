const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("DB Server Started at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error '${e.message}'`);
    process.exit(1);
  }
};

initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  const tokenizedPassword = await bcrypt.hash(password, 10);
  if (dbUser === undefined) {
    if (password.length > 6) {
      query = `
        INSERT INTO user (username, password, name, gender)
        VALUES ('${username}', '${tokenizedPassword}', '${name}', '${gender}');`;
      db.run(query);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const convertToObject = (object) => {
  return {
    username: object.username,
    tweet: object.tweet,
    dateTime: object.date_time,
  };
};

const convertInToTweetObject = (object) => {
  return {
    username: object.username,
    tweet: object.tweet,
    dateTime: object.date_time,
  };
};

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const authHeader = request.headers["authorization"];
  let jwtToken = authHeader.split(" ")[1];
  const payload = jwt.verify(jwtToken, "MY_SECRET_TOKEN");
  //console.log(payload);
  const getUserID = `
  SELECT user_id from user WHERE username = '${payload.username}';`;
  const dbObject = await db.get(getUserID);
  //console.log(dbObject.user_id);

  const query = `
    SELECT username, tweet, date_time FROM user 
    AS u JOIN tweet AS t ON u.user_id = t.user_id 
    JOIN follower as f ON f.following_user_id = u.user_id
    WHERE f.follower_user_id = ${dbObject.user_id} ORDER BY date_time DESC LIMIT 4;`;
  //console.log(query);
  const dbObject1 = await db.all(query);
  console.log(dbObject1);
  response.send(dbObject1.map((object) => convertInToTweetObject(object)));
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  const authHeader = request.headers["authorization"];
  let jwtToken = authHeader.split(" ")[1];
  const payload = jwt.verify(jwtToken, "MY_SECRET_TOKEN");
  //console.log(payload);
  const getUserID = `
  SELECT user_id from user WHERE username = '${payload.username}';`;
  const dbObject = await db.get(getUserID);
  console.log(dbObject.user_id);

  const query = `SELECT u.name FROM follower as f JOIN user as u ON f.following_user_id = u.user_id WHERE f.follower_user_id = ${dbObject.user_id};`;
  console.log(query);
  const dbObject1 = await db.all(query);
  response.send(dbObject1);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const authHeader = request.headers["authorization"];
  let jwtToken = authHeader.split(" ")[1];
  const payload = jwt.verify(jwtToken, "MY_SECRET_TOKEN");
  //console.log(payload);
  const getUserID = `
  SELECT user_id from user WHERE username = '${payload.username}';`;
  const dbObject = await db.get(getUserID);
  //console.log(dbObject.user_id);

  const query = `
  SELECT u.name FROM follower as f 
  JOIN user as u ON f.follower_user_id = u.user_id 
   WHERE f.following_user_id = ${dbObject.user_id}`;

  const dbObject1 = await db.all(query);
  response.send(dbObject1);
});

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const authHeader = request.headers["authorization"];
  let jwtToken = authHeader.split(" ")[1];
  const payload = jwt.verify(jwtToken, "MY_SECRET_TOKEN");

  const query = `SELECT A.tweet, B.likes, A.replies, A.dateTime FROM 
  (SELECT t.tweet_id, t.tweet, COUNT(reply_id) AS replies, t.date_time AS dateTime 
  FROM tweet AS t JOIN user as u ON t.user_id = u.user_id LEFT JOIN reply AS r ON r.tweet_id = t.tweet_id 
  WHERE u.username = '${payload.username}' GROUP BY t.tweet_id) AS A JOIN 
  (SELECT t.tweet_id, COUNT(like_id) AS likes FROM tweet AS t JOIN user as u ON t.user_id = u.user_id JOIN like AS r 
  ON r.tweet_id = t.tweet_id WHERE u.username = '${payload.username}' GROUP BY t.tweet_id) AS B 
  ON A.tweet_id = B.tweet_id;`;
  const dbObject = await db.all(query);
  response.send(dbObject);
});

const convertToTweetObject1 = (obj) => {
  return {
    tweet: obj.tweet,
    likes: obj.likes,
    replies: obj.replies,
    dateTime: obj.dateTime,
  };
};

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const authHeader = request.headers["authorization"];
  let jwtToken = authHeader.split(" ")[1];
  const payload = jwt.verify(jwtToken, "MY_SECRET_TOKEN");
  const { tweetId } = request.params;

  //console.log(payload);
  const getUserID = `
  SELECT user_id from user WHERE username = '${payload.username}';`;
  const dbObject = await db.get(getUserID);
  //console.log(dbObject.user_id);

  const checkQuery = `
  SELECT * FROM follower as f 
  JOIN tweet as t on f.following_user_id = t.user_id 
  WHERE f.follower_user_id = ${dbObject.user_id} AND 
  t.tweet_id = ${tweetId};`;

  const dbObject3 = await db.get(checkQuery);

  if (dbObject3 !== undefined) {
    const query = `SELECT * FROM 
    (SELECT t.tweet_id, t.tweet, COUNT(r.reply_id) AS replies, t.date_time AS dateTime FROM tweet AS t 
    JOIN reply AS r ON t.tweet_id = r.tweet_id WHERE t.tweet_id = ${tweetId} GROUP BY t.tweet_id) AS A LEFT JOIN  
    (SELECT t.tweet_id, COUNT(r.like_id) AS likes FROM tweet AS t JOIN like AS r ON t.tweet_id = r.tweet_id 
    WHERE t.tweet_id = ${tweetId} GROUP BY t.tweet_id) AS B ON A.tweet_id = B.tweet_id;`;
    //  UNION SELECT * FROM
    // (SELECT t.tweet_id, t.tweet, COUNT(r.like_id) AS likes, t.date_time AS dateTime FROM tweet AS t
    // JOIN like AS r ON t.tweet_id = r.tweet_id WHERE t.tweet_id = ${tweetId} GROUP BY t.tweet_id) AS C LEFT JOIN
    // (SELECT t.tweet_id, COUNT(r.reply_id) AS replies FROM tweet AS t JOIN reply AS r ON t.tweet_id = r.tweet_id
    // WHERE t.tweet_id = ${tweetId} GROUP BY t.tweet_id) AS D ON C.tweet_id = D.tweet_id;`;

    const dbObject1 = await db.get(query);
    console.log(await db.all(query));
    response.send(convertToTweetObject1(dbObject1));
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

const convertToLikeObject = (object) => {
  let arr = [];
  for (item of object) {
    arr.push(item.username);
  }
  return {
    likes: arr,
  };
};

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const authHeader = request.headers["authorization"];
    let jwtToken = authHeader.split(" ")[1];
    const payload = jwt.verify(jwtToken, "MY_SECRET_TOKEN");
    //console.log(payload);
    const getUserID = `
  SELECT user_id from user WHERE username = '${payload.username}';`;
    const dbObject = await db.get(getUserID);
    //console.log(dbObject.user_id);

    const { tweetId } = request.params;

    const checkQuery = `
        SELECT * FROM follower as f 
        JOIN tweet as t on f.following_user_id = t.user_id 
        WHERE f.follower_user_id = ${dbObject.user_id} AND 
        t.tweet_id = ${tweetId};`;

    const dbObject3 = await db.get(checkQuery);
    console.log(dbObject3);

    if (dbObject3 !== undefined) {
      const query = `
        SELECT u.username FROM tweet as t 
        JOIN like as r ON t.tweet_id = r.tweet_id 
        JOIN user as u ON r.user_id = u.user_id 
        WHERE t.tweet_id = ${tweetId};`;

      const dbObject1 = await db.all(query);
      response.send(convertToLikeObject(dbObject1));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

const convertToReplyObject = (object) => {
  return {
    replies: object,
  };
};

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const authHeader = request.headers["authorization"];
    let jwtToken = authHeader.split(" ")[1];
    const payload = jwt.verify(jwtToken, "MY_SECRET_TOKEN");
    //console.log(payload);
    const getUserID = `
  SELECT user_id from user WHERE username = '${payload.username}';`;
    const dbObject = await db.get(getUserID);
    //console.log(dbObject.user_id);

    const { tweetId } = request.params;

    const checkQuery = `
        SELECT * FROM follower as f 
        JOIN tweet as t on f.following_user_id = t.user_id 
        WHERE f.follower_user_id = ${dbObject.user_id} AND 
        t.tweet_id = ${tweetId};`;

    const dbObject3 = await db.get(checkQuery);
    console.log(dbObject3);

    if (dbObject3 !== undefined) {
      const query = `
        SELECT u.name, r.reply FROM tweet as t 
        JOIN reply as r ON t.tweet_id = r.tweet_id 
        JOIN user as u ON r.user_id = u.user_id 
        WHERE t.tweet_id = ${tweetId};`;

      const dbObject1 = await db.all(query);
      response.send(convertToReplyObject(dbObject1));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const authHeader = request.headers["authorization"];
    let jwtToken = authHeader.split(" ")[1];
    const payload = jwt.verify(jwtToken, "MY_SECRET_TOKEN");

    const getUserID = `
    SELECT user_id from user WHERE username = '${payload.username}';`;
    const dbObject = await db.get(getUserID);

    const isUserQuote = `
    SELECT t.tweet_id FROM tweet AS t WHERE 
    t.user_id = '${dbObject.user_id}';`;

    const dbObject1 = await db.get(isUserQuote);

    if (dbObject1 === undefined) {
      response.statusCode = 401;
      response.send("Invalid Request");
    } else {
      const removeTweet = `
        DELETE FROM tweet WHERE tweet_id = ${dbObject1.tweet_id};`;
      await db.run(removeTweet);
      response.send("Tweet Removed");
    }
  }
);

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const createDate = new Date();

  const authHeader = request.headers["authorization"];
  let jwtToken = authHeader.split(" ")[1];
  const payload = jwt.verify(jwtToken, "MY_SECRET_TOKEN");
  const getUserID = `
  SELECT user_id from user WHERE username = '${payload.username}';`;
  const dbObject = await db.get(getUserID);

  const insertIntoDB = `
  INSERT INTO tweet (tweet, user_id, date_time) VALUES ('${tweet}', ${dbObject.user_id}, '${createDate}');`;
  await db.run(insertIntoDB);
  response.send("Created a Tweet");
});

module.exports = app;
