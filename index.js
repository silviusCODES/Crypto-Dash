import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import path from "path";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;


app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set('views', path.join(process.cwd(), 'views'));

// Fucntion to fetch global market data
const fetchGlobalData = async () => {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/global');
        return response.data.data;
    } catch (error) {
        console.error("Error fetching global data:", error);
        return null;
    }
};

// Root route to fetch cryptocurrency data and render it
app.get("/", async(req, res) => {
    try {
        // Fetch top 10 cryptocurrencies from CoinGecko API
        const response = await axios.get("https://api.coingecko.com/api/v3/coins/markets", {
            params:{
                vs_currency: "usd",
                order: "market_cap_desc",
                per_page: 36,
                page: 1,
                sparkline: false
            }
        });
        const cryptoData = response.data;

        const globalData = await fetchGlobalData();

        // Render the "home" view with retrieved cryptocurrency data
        res.render("home", {cryptoData, globalData});
    } catch (error) {
        console.error("Error fetching data from CoinGecko API:", error);
        res.status(500).send("Error fetching cryptocurrency data");
    }
});

app.get('/about', (req, res) => {
    res.render('about');
});

// New search route
app.get("/search", async(req, res) => {
    const query = req.query.query;
    try {
        const response = await axios.get(`https://api.coingecko.com/api/v3/coins/markets`, {
            params: {
                vs_currency: 'usd',
                order: 'market_cap_desc',
                per_page: 100, // Adjust as necessary
                page: 1,
                sparkline: false,
            },
        });
        const allCryptos = response.data;
        const filteredCryptos = allCryptos.filter(crypto => 
            crypto.name.toLowerCase().includes(query.toLowerCase()) || 
            crypto.symbol.toLowerCase().includes(query.toLowerCase())
        );
        res.render('searchResults', {filteredCryptos});
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching data');
    }
});

// Add a route for search results display
app.get('/searchResults', (req, res) => {
    res.render('searchResults', { filteredCryptos: [] }); // initial empty results
});

//Dynamic route for individual coin details
app.get("/coin/:id", async (req, res) => {
    const coinId = req.params.id;
    try {
        // Fetch detailed information about the specific coin
        const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${coinId}`);
        const coinDetails = response.data;

        // Fetch historical price data (last 30 days)
        const historyResponse = await axios.get(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`, {
            params: {
                vs_currency: 'usd',
                days: 30,
                interval: 'daily'
            }
        });
        const priceHistory = historyResponse.data.prices; // Array of [timestamp, price]

        // Format the data for the chart
        const labels = priceHistory.map(price => new Date(price[0]).toLocaleDateString());
        const prices = priceHistory.map(price => price[1]);

        // Render the "coin" view with retrieved coin details
        res.render("coin", {coinDetails, labels, prices});
    } catch (error) {
        console.error("Error fetching data from CoinGecko API for coin details:", error);
        res.status(500).send("Error fetching cryptocurrency details");
    }
});

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log('A user connected');

    // Fetch global data and send to the client every 10 seconds
    const sendGlobalData = async () => {
        const globalData = await fetchGlobalData();
        socket.emit('globalData', globalData);
    };

    sendGlobalData(); // Send initial data
    const interval = setInterval(sendGlobalData, 10000); // Send data every 10 seconds

    socket.on('disconnect', () => {
        console.log('User disconnected');
        clearInterval(interval);
    });
});


//start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});