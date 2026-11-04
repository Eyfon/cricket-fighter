const stage = {
    name: "Café",
    layers: [
        {
            src: ["./assets/bg.jpg", "./assets/bg2.jpg"],
            animSpeed: 0.5, // Seconds per frame
            color: "#0a0f1a", y: 0, scroll: 0.1
        },
        { color: "#1a2033", y: 120, scroll: 0.2 },
        { color: "#24324a", y: 220, scroll: 0.4 },
        {
            color: "#304a5a",
            y: 320,
            scroll: 0.7
        },
    ],
    floorColor: "#2a2318"
};

export default stage;