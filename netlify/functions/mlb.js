exports.handler = async () => {
  // All unique pool players
  const POOL_PLAYERS = [
    "Pete Alonso","Elly De La Cruz","Roman Anthony","Corey Seager","Vladimir Guerrero Jr.",
    "Fernando Tatis Jr.","Bobby Witt Jr.","Jake Burger","Jorge Soler","Gunnar Henderson",
    "Coby Mayo","Jackson Merrill","Daylen Lile","Cam Smith","Luis Robert Jr.","Dominic Canzone",
    "Kyle Schwarber","Aaron Judge","Julio Rodríguez","Francisco Lindor","Josh Naylor","Bo Bichette",
    "Nolan Gorman","Christopher Morel","Jake Cronenworth","Tyler Soderstrom","José Ramírez",
    "Ronald Acuña Jr.","Dylan Crews","Oneil Cruz","Tyler O'Neill","Spencer Torkelson",
    "Freddie Freeman","Gavin Sheets","Luis Arráez","Austin Riley","Shohei Ohtani","Trea Turner",
    "Mike Trout","Andrew Vaughn","Ezequiel Tovar","Ketel Marte","Nick Kurtz","Noelvi Marté",
    "Francisco Alvarez","Kyle Tucker","Colson Montgomery","Daulton Varsho","Matt McLain",
    "Pete Crow-Armstrong","Iván Herrera","Giancarlo Stanton","Brent Rooker","Teoscar Hernández",
    "Josh Lowe","Adolis García","Jackson Chourio","James Wood","Ben Rice","Wyatt Langford",
    "Jeff McNeil","Mookie Betts","Jarren Duran","Jonathan Aranda","Juan Soto","Cody Bellinger",
    "Alex Bregman","Adley Rutschman","Jonathan India","Joc Pederson","Ozzie Albies",
    "Spencer Steer","Lars Nootbaar","Dansby Swanson","Bryan Reynolds","Alec Bohm","Austin Wells",
    "Jacob Wilson","Junior Caminero","Royce Lewis","Bryce Harper","Agustín Ramírez","Kyle Teel"
  ];

  const hrMap = {};

  try {
    // Step 1: Get leaderboard for the bulk of players with HRs
    const leaderUrl = 'https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=homeRuns&season=2026&sportId=1&limit=1000&statGroup=hitting';
    const leaderRes = await fetch(leaderUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });

    if (leaderRes.ok) {
      const data = await leaderRes.json();
      const leaders = data.leagueLeaders?.[0]?.leaders || [];
      for (const l of leaders) {
        if (l.person?.fullName) {
          hrMap[l.person.fullName] = parseInt(l.value) || 0;
        }
      }
    }

    // Step 2: For pool players not found in leaderboard (0 HRs early in season),
    // look them up individually using the MLB people search + stats endpoint
    const notFound = POOL_PLAYERS.filter(name => hrMap[name] === undefined);

    for (const name of notFound) {
      try {
        // Search for the player by name
        const searchUrl = `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(name)}&sportId=1`;
        const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!searchRes.ok) { hrMap[name] = 0; continue; }

        const searchData = await searchRes.json();
        const person = searchData.people?.[0];
        if (!person?.id) { hrMap[name] = 0; continue; }

        // Get their 2026 season stats
        const statsUrl = `https://statsapi.mlb.com/api/v1/people/${person.id}/stats?stats=season&season=2026&group=hitting`;
        const statsRes = await fetch(statsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!statsRes.ok) { hrMap[name] = 0; continue; }

        const statsData = await statsRes.json();
        const splits = statsData.stats?.[0]?.splits || [];
        const hr = splits.reduce((sum, s) => sum + (s.stat?.homeRuns || 0), 0);
        hrMap[name] = hr;

      } catch(e) {
        hrMap[name] = 0;
      }
    }

    // Set 0 for any remaining pool players
    for (const name of POOL_PLAYERS) {
      if (hrMap[name] === undefined) hrMap[name] = 0;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hrMap),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
