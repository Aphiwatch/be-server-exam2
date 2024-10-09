const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Client } = require("pg");

const app = express();
const port = 1377;

app.use(cors());
app.use(bodyParser.json());

const client = new Client({
  user: "postgres",
  host: "localhost",
  database: "pokemondb",
  password: "x10pgac09",
  port: 5432,
});

client.connect();

app.get("/pokemons", async (req, res) => {
  const limit = 10;
  const offset = req.query.offset ? parseInt(req.query.offset) : 0;

  try {
    const query = `
        SELECT p.*, 
          ARRAY_AGG(DISTINCT pt.type) AS types,
          ARRAY_AGG(DISTINCT pw.weakness) AS weaknesses,
          json_agg(DISTINCT jsonb_build_object('num', pe.next_num, 'name', pe.next_name)) AS next_evolution,
          json_agg(DISTINCT jsonb_build_object('num', pe.prev_num, 'name', pe.prev_name)) AS prev_evolution
        FROM pokemon p
        LEFT JOIN pokemon_type pt ON p.id = pt.pokemon_id
        LEFT JOIN pokemon_weakness pw ON p.id = pw.pokemon_id
        LEFT JOIN pokemon_evolution pe ON p.id = pe.pokemon_id
        GROUP BY p.id
        ORDER BY p.id
        LIMIT $1 OFFSET $2
      `;

    const result = await client.query(query, [limit, offset]);

    const pokemons = result.rows.map((pokemon) => {
      const filteredNextEvolution = pokemon.next_evolution.filter(
        (evo) => evo.num !== null && evo.name !== null
      );

      const filteredPrevEvolution = pokemon.prev_evolution.filter(
        (evo) => evo.num !== null && evo.name !== null
      );

      return {
        id: pokemon.id,
        num: pokemon.num,
        name: pokemon.name,
        img: pokemon.img,
        type: pokemon.types,
        height: pokemon.height,
        weight: pokemon.weight,
        candy: pokemon.candy,
        egg: pokemon.egg,
        multipliers: pokemon.multipliers ? pokemon.multipliers : null,
        weaknesses: pokemon.weaknesses,
        candy_count: pokemon.candy_count,
        spawn_chance: pokemon.spawn_chance,
        avg_spawns: pokemon.avg_spawns,
        spawn_time: pokemon.spawn_time,
        prev_evolution: filteredPrevEvolution,
        next_evolution: filteredNextEvolution,
      };
    });

    res.json(pokemons);
  } catch (error) {
    console.error("Error fetching pokemons:", error);
    res.status(500).send("Error fetching pokemons");
  }
});

app.post("/add-new-pokemon", async (req, res) => {
  const {
    num,
    name,
    img,
    height,
    weight,
    candy,
    egg,
    multipliers,
    spawn_chance,
    avg_spawns,
    spawn_time,
    types,
    weaknesses,
    prev_evolution,
    next_evolution,
  } = req.body;

  try {
    await client.query("BEGIN");

    const pokemonInsertResult = await client.query(
      `INSERT INTO pokemon (num, name, img, height, weight, candy, egg, multipliers, spawn_chance, avg_spawns, spawn_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id;`,
      [
        num,
        name,
        img,
        height,
        weight,
        candy,
        egg,
        multipliers,
        spawn_chance,
        avg_spawns,
        spawn_time,
      ]
    );

    const pokemonId = pokemonInsertResult.rows[0].id;

    if (types && types.length > 0) {
      for (const type of types) {
        await client.query(
          `INSERT INTO pokemon_type (pokemon_id, type) VALUES ($1, $2);`,
          [pokemonId, type]
        );
      }
    }

    if (weaknesses && weaknesses.length > 0) {
      for (const weakness of weaknesses) {
        await client.query(
          `INSERT INTO pokemon_weakness (pokemon_id, weakness) VALUES ($1, $2);`,
          [pokemonId, weakness]
        );
      }
    }

    if (next_evolution && next_evolution.length > 0) {
      for (const evolution of next_evolution) {
        await client.query(
          `INSERT INTO pokemon_evolution (pokemon_id, next_num, next_name) VALUES ($1, $2, $3);`,
          [pokemonId, evolution.num, evolution.name]
        );
      }
    }

    if (prev_evolution && prev_evolution.length > 0) {
      for (const evolution of prev_evolution) {
        await client.query(
          `INSERT INTO pokemon_evolution (pokemon_id, prev_num, prev_name) VALUES ($1, $2, $3);`,
          [pokemonId, evolution.num, evolution.name]
        );
      }
    }

    await client.query("COMMIT");

    res.status(201).json({ id: pokemonId });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error adding pokemon:", error);
    res.status(500).send("Error adding pokemon");
  }
});

app.put("/edit-pokemon-info/:id", async (req, res) => {
  const id = req.params.id;
  const {
    num,
    name,
    img,
    height,
    weight,
    candy,
    egg,
    multipliers,
    spawn_chance,
    avg_spawns,
    spawn_time,
    prev_evolution,
    next_evolution,

  } = req.body;

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
          UPDATE pokemon SET 
            num = $1, 
            name = $2, 
            img = $3, 
            height = $4, 
            weight = $5, 
            candy = $6, 
            egg = $7, 
            multipliers = $8, 
            spawn_chance = $9, 
            avg_spawns = $10, 
            spawn_time = $11
          WHERE id = $12
          RETURNING *;
        `,
      [
        num,
        name,
        img,
        height,
        weight,
        candy,
        egg,
        multipliers,
        spawn_chance,
        avg_spawns,
        spawn_time,
        id,
      ]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).send("Pokemon not found.");
    }

    await client.query(`DELETE FROM pokemon_evolution WHERE pokemon_id = $1;`, [
      id,
    ]);

    if (next_evolution && next_evolution.length > 0) {
      for (const evolution of next_evolution) {
        await client.query(
          `INSERT INTO pokemon_evolution (pokemon_id, next_num, next_name) VALUES ($1, $2, $3);`,
          [id, evolution.num, evolution.name]
        );
      }
    }

    if (prev_evolution && prev_evolution.length > 0) {
      for (const evolution of prev_evolution) {
        await client.query(
          `INSERT INTO pokemon_evolution (pokemon_id, prev_num, prev_name) VALUES ($1, $2, $3);`,
          [id, evolution.num, evolution.name]
        );
      }
    }

    await client.query("COMMIT"); 

    res.status(200).json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK"); 
    console.error("Error updating pokemon:", error);
    res.status(500).send("Error updating pokemon");
  }
});

app.delete("/delete-pokemon/:id", async (req, res) => {
  const id = req.params.id;

  try {
    await client.query("DELETE FROM pokemon_type WHERE pokemon_id = $1", [id]);

    await client.query("DELETE FROM pokemon_weakness WHERE pokemon_id = $1", [
      id,
    ]);

    await client.query("DELETE FROM pokemon_evolution WHERE pokemon_id = $1", [
      id,
    ]);

    const result = await client.query(
      "DELETE FROM pokemon WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).send("Pokemon not found");
    }

    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting pokemon:", error);
    res.status(500).send("Error deleting pokemon");
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
