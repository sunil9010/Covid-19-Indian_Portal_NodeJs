const express = require("express");
const app = express();
app.use(express.json());
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const InitializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error ${error.message}`);
    process.exit(1);
  }
};
InitializeDbAndServer();
// Middleware

const authenticateToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "HiAll", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userDetails = `
    SELECT
    *
    FROM
    user
    WHERE
    username = '${username}'
    `;
  const dbUser = await db.get(userDetails);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const comparePassword = await bcrypt.compare(password, dbUser.password);
    if (comparePassword) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "HiAll");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const convertDbObjectTo = (DbQuery) => {
  return {
    stateId: DbQuery.state_id,
    stateName: DbQuery.state_name,
    population: DbQuery.population,
  };
};

app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStates = `
    SELECT
    *
    FROM
    state
    `;
  const statesQuery = await db.all(getAllStates);
  response.send(statesQuery.map((each) => convertDbObjectTo(each)));
});

app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const IdQuery = `
    SELECT
    *
    FROM
    state
    WHERE
    state_id = '${stateId}'
    ;`;
  const queryResponse = await db.get(IdQuery);
  response.send(convertDbObjectTo(queryResponse));
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postQuery = `
  INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
  VALUES(
    '${districtName}',
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths}
  );
  `;
  await db.run(postQuery);
  response.send("District Successfully Added");
});

const convertDistrictDb = (each) => {
  return {
    districtId: each.district_id,
    districtName: each.district_name,
    stateId: each.state_id,
    cases: each.cases,
    cured: each.cured,
    active: each.active,
    deaths: each.deaths,
  };
};

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const IdQuery = `
    SELECT
    *
    FROM
    district
    WHERE
    district_id = '${districtId}'
    ;`;
    const queryResponse = await db.get(IdQuery);
    response.send(convertDistrictDb(queryResponse));
  }
);

app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteRequest = `
    DELETE FROM
    district
    WHERE
    district_id = '${districtId}'
    `;
    await db.run(deleteRequest);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateData = `
    UPDATE district
    SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    `;
    await db.run(updateData);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const gettingQuery = `
    SELECT
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
    FROM
    district
    WHERE
    state_id = '${stateId}'
    `;
    const stats = await db.get(gettingQuery);
    response.send({
      totalCases: stats["totalCases"],
      totalCured: stats["totalCured"],
      totalActive: stats["totalActive"],
      totalDeaths: stats["totalDeaths"],
    });
  }
);
module.exports = app;
