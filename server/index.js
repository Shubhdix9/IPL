const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// REST API Routes

// Login Endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  const user = await prisma.user.findUnique({
    where: { username }
  });

  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // In a real app, do not send back the password, and use JWT
  const { password: _, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// Get all teams with their bought players
app.get('/api/teams', async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      include: { players: true }
    });
    res.json(teams);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update team disqualification status
app.put('/api/teams/:id/disqualify', async (req, res) => {
  const { isDisqualified } = req.body;
  try {
    const team = await prisma.team.update({
      where: { id: parseInt(req.params.id) },
      data: { isDisqualified }
    });
    io.emit('penaltyIssued', { teamId: team.id, mistakes: team.mistakes, isDisqualified });
    res.json(team);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all players for a specific location
app.get('/api/locations/:locationId/players', async (req, res) => {
  const players = await prisma.player.findMany({
    where: { locationId: parseInt(req.params.locationId) },
    include: { team: true }
  });
  res.json(players);
});

// Get all users
app.get('/api/users', async (req, res) => {
  const users = await prisma.user.findMany({
    include: { team: true, location: true },
    orderBy: { role: 'asc' }
  });
  // Note: For this application, we explicitly return the password so the League Manager can view/manage them
  res.json(users);
});

// Create user
app.post('/api/users', async (req, res) => {
  const { username, password, role, teamId, locationId } = req.body;
  try {
    const user = await prisma.user.create({
      data: {
        username,
        password,
        role,
        teamId: teamId ? parseInt(teamId) : null,
        locationId: locationId ? parseInt(locationId) : null,
      }
    });
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all locations
app.get('/api/locations', async (req, res) => {
  const locations = await prisma.location.findMany({
    include: { teams: true, users: true }
  });
  res.json(locations);
});

// Create location & auto-generate fixed franchises
app.post('/api/locations', async (req, res) => {
  const { name } = req.body;
  try {
    const location = await prisma.location.create({
      data: { name }
    });

    const teamNames = ['CSK', 'MI', 'RCB', 'DC', 'KKR', 'PBKS', 'RR', 'SRH', 'LSG', 'GT'];
    
    // Auto-generate teams and users for this new location
    for (const tName of teamNames) {
      const team = await prisma.team.create({
        data: { name: tName, budget: 900000000, locationId: location.id }
      });

      await prisma.user.create({
        data: {
          username: `owner_${tName.toLowerCase()}_${location.name.toLowerCase().replace(/\s+/g, '')}`,
          password: 'password', // Default
          role: 'TEAM_LEADER',
          teamId: team.id
        }
      });
    }

    res.json(location);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete location
app.delete('/api/locations/:id', async (req, res) => {
  try {
    await prisma.location.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Bulk create players for a specific location (kept for backward compatibility if needed)
app.post('/api/locations/:locationId/players/bulk', async (req, res) => {
  const { players } = req.body;
  const locationId = parseInt(req.params.locationId);
  try {
    const playersWithLocation = players.map(p => ({ ...p, locationId }));
    await prisma.player.createMany({ data: playersWithLocation });
    res.json({ success: true, count: players.length });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Bulk create players for ALL locations globally
app.post('/api/players/bulk-global', async (req, res) => {
  const { players } = req.body;
  try {
    const locations = await prisma.location.findMany();
    if (locations.length === 0) {
      return res.status(400).json({ error: "No venues found. Please create a venue first." });
    }

    const allPlayersToInsert = [];
    
    // For every location, duplicate the parsed players
    locations.forEach(loc => {
      players.forEach(p => {
        allPlayersToInsert.push({ ...p, locationId: loc.id });
      });
    });

    await prisma.player.createMany({
      data: allPlayersToInsert
    });
    
    res.json({ success: true, count: allPlayersToInsert.length, locationsCount: locations.length });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Danger Zone: Delete ALL players globally
app.delete('/api/players', async (req, res) => {
  try {
    await prisma.bid.deleteMany({});
    await prisma.player.deleteMany({});
    await prisma.team.updateMany({
      data: {
        budget: 900000000,
        mistakes: 0,
        isDisqualified: false
      }
    });
    res.json({ success: true, message: "All players deleted and team budgets reset." });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update user password
app.put('/api/users/:id/password', async (req, res) => {
  const { password } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { password }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete user (Auctioneer)
app.delete('/api/users/:id', async (req, res) => {
  try {
    await prisma.user.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create team for a specific location (Kept just in case, though unused in UI now)
app.post('/api/locations/:locationId/teams', async (req, res) => {
  const { name, budget } = req.body;
  const locationId = parseInt(req.params.locationId);
  try {
    const team = await prisma.team.create({
      data: {
        name,
        budget: budget ? parseFloat(budget) : 900000000,
        locationId
      }
    });

    // Auto-generate credentials for the franchise owner
    const location = await prisma.location.findUnique({ where: { id: locationId } });
    const username = `owner_${name.toLowerCase().replace(/\s+/g, '')}_${location.name.toLowerCase().replace(/\s+/g, '')}`;
    
    await prisma.user.create({
      data: {
        username: username,
        password: 'password', // Default password
        role: 'TEAM_LEADER',
        teamId: team.id
      }
    });

    res.json(team);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Socket.io Real-time logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinLocation', (locationId) => {
    socket.join(`location_${locationId}`);
    console.log(`User joined location ${locationId}`);
  });

  socket.on('setLivePlayer', async (data) => {
    const { locationId, playerId } = data;
    
    // Update player status in DB
    const player = await prisma.player.update({
      where: { id: playerId },
      data: { status: 'LIVE' },
      include: { team: true }
    });

    // Broadcast to location
    io.to(`location_${locationId}`).emit('livePlayerUpdated', player);
  });

  socket.on('placeBid', async (data) => {
    const { locationId, playerId, teamId, amount } = data;
    // Log bid
    const bid = await prisma.bid.create({
      data: {
        playerId,
        teamId,
        amount
      }
    });

    // Update current bid info across location
    io.to(`location_${locationId}`).emit('newBid', { playerId, teamId, amount, locationId });
  });

  socket.on('reverseBid', async (data) => {
    const { locationId, playerId, previousAmount, previousTeamId } = data;
    
    // Find and delete the latest bid for this player
    const latestBid = await prisma.bid.findFirst({
      where: { playerId },
      orderBy: { timestamp: 'desc' }
    });

    if (latestBid) {
      await prisma.bid.delete({
        where: { id: latestBid.id }
      });
    }

    // Broadcast the reverted state (acts like a new bid to clients)
    io.to(`location_${locationId}`).emit('newBid', { 
      playerId, 
      teamId: previousTeamId ? parseInt(previousTeamId) : null, 
      amount: previousAmount, 
      locationId 
    });
  });

  socket.on('issuePenalty', async (data) => {
    const { teamId, locationId } = data;
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return;

    const newMistakes = team.mistakes + 1;
    const isDisqualified = newMistakes >= 3;

    await prisma.team.update({
      where: { id: teamId },
      data: {
        mistakes: newMistakes,
        isDisqualified
      }
    });

    // Broadcast penalty to everyone so UI updates instantly
    if (locationId) {
      io.to(`location_${locationId}`).emit('penaltyIssued', { teamId, mistakes: newMistakes, isDisqualified });
    } else {
      io.emit('penaltyIssued', { teamId, mistakes: newMistakes, isDisqualified });
    }
  });

  socket.on('reversePenalty', async (data) => {
    const { teamId, locationId } = data;
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team || team.mistakes <= 0) return;

    const newMistakes = team.mistakes - 1;
    const isDisqualified = newMistakes >= 3;

    await prisma.team.update({
      where: { id: teamId },
      data: {
        mistakes: newMistakes,
        isDisqualified
      }
    });

    // Broadcast updated penalty state
    if (locationId) {
      io.to(`location_${locationId}`).emit('penaltyIssued', { teamId, mistakes: newMistakes, isDisqualified });
    } else {
      io.emit('penaltyIssued', { teamId, mistakes: newMistakes, isDisqualified });
    }
  });

  socket.on('toggleLeaderboard', (data) => {
    const { locationId, show } = data;
    io.to(`location_${locationId}`).emit('leaderboardToggled', show);
  });



  socket.on('sellPlayer', async (data) => {
    const { locationId, playerId, teamId, amount } = data;
    
    // Prevent double-click vulnerabilities by ensuring player is LIVE
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player || player.status !== 'LIVE') return;

    // Deduct from team purse and update player
    const transaction = await prisma.$transaction([
      prisma.player.update({
        where: { id: playerId },
        data: { status: 'SOLD', soldPrice: amount, teamId }
      }),
      prisma.team.update({
        where: { id: teamId },
        data: {
          budget: { decrement: amount }
        }
      })
    ]);

    io.to(`location_${locationId}`).emit('playerSold', transaction[0]);
  });

  socket.on('unsoldPlayer', async (data) => {
    const { locationId, playerId } = data;
    
    const player = await prisma.player.update({
      where: { id: playerId },
      data: { status: 'UNSOLD' }
    });

    io.to(`location_${locationId}`).emit('playerUnsold', player);
  });

  socket.on('toggleBreak', (data) => {
    const { locationId, show } = data;
    io.to(`location_${locationId}`).emit('auctionBreakToggled', { locationId, show });
  });

  socket.on('reopenPlayer', async (data) => {
    const { locationId, playerId } = data;
    
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return;

    if (player.status === 'SOLD' && player.teamId && player.soldPrice) {
      // Refund the team
      await prisma.team.update({
        where: { id: player.teamId },
        data: { budget: { increment: player.soldPrice } }
      });
    }

    // Reset player status
    const updatedPlayer = await prisma.player.update({
      where: { id: playerId },
      data: { status: 'LIVE', soldPrice: null, teamId: null }
    });

    io.to(`location_${locationId}`).emit('playerReopened', updatedPlayer);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
