const axios = require("axios");
const { Client } = require("pg");

const url = "https://run.mocky.io/v3/d4f2daed-b182-4e07-973a-02f8852d80f9";

const insertPokemons = async () => {
  try {
    const response = await axios.get(url);
    const pokemonData = response.data;

    const client = new Client({
      user: "postgres",
      host: "localhost",
      database: "pokemondb",
      password: "x10pgac09",
      port: 5432,
    });

    await client.connect();

    for (const pokemon of pokemonData) {
      const height = parseFloat(pokemon.height);
      const weight = parseFloat(pokemon.weight);
      const multipliers = pokemon.multipliers ? pokemon.multipliers : null;

      const res = await client.query(
        `
                INSERT INTO pokemon (num, name, img, height, weight, candy, egg, multipliers, spawn_chance, avg_spawns, spawn_time, candy_count)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id;
            `,
        [
          pokemon.num,
          pokemon.name,
          pokemon.img,
          height,
          weight,
          pokemon.candy,
          pokemon.egg,
          multipliers,
          pokemon.spawn_chance,
          pokemon.avg_spawns,
          pokemon.spawn_time,
          pokemon.candy_count 
        ]
      );

      const pokemonId = res.rows[0].id;

      for (const type of pokemon.type) {
        await client.query(
          `
                    INSERT INTO pokemon_type (pokemon_id, type)
                    VALUES ($1, $2);
                `,
          [pokemonId, type]
        );
      }

      for (const weakness of pokemon.weaknesses) {
        await client.query(
          `
                    INSERT INTO pokemon_weakness (pokemon_id, weakness)
                    VALUES ($1, $2);
                `,
          [pokemonId, weakness]
        );
      }

      if (pokemon.prev_evolution) {
        for (const evolution of pokemon.prev_evolution) {
          await client.query(
            `
                        INSERT INTO pokemon_evolution (pokemon_id, prev_num, prev_name)
                        VALUES ($1, $2, $3);
                    `,
            [pokemonId, evolution.num, evolution.name]
          );
        }
      }

      if (pokemon.next_evolution) {
        for (const nextEvolution of pokemon.next_evolution) {
          await client.query(
            `
                        INSERT INTO pokemon_evolution (pokemon_id, next_num, next_name)
                        VALUES ($1, $2, $3);
                    `,
            [pokemonId, nextEvolution.num, nextEvolution.name]
          );
        }
      }
    }

    await client.end();
    console.log("เพิ่มข้อมูลลงใน Postgres สำเร็จ");
  } catch (error) {
    console.error("เกิดข้อผิดพลาด:", error);
  }
};

insertPokemons();
