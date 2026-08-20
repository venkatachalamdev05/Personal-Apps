const CACHE_NAME =
    "daily-tracker-v1";


const FILES = [

    "./",

    "./index.html",

    "./style.css",

    "./app.js",

    "./db.js",

    "./manifest.json"

];


self.addEventListener(
    "install",
    event => {

        event.waitUntil(

            caches
                .open(
                    CACHE_NAME
                )
                .then(
                    cache =>
                        cache.addAll(
                            FILES
                        )
                )

        );

        self.skipWaiting();

    }
);


self.addEventListener(
    "activate",
    event => {

        event.waitUntil(
            self.clients.claim()
        );

    }
);


self.addEventListener(
    "fetch",
    event => {

        event.respondWith(

            caches
                .match(
                    event.request
                )
                .then(
                    cached => {

                        return (
                            cached ||
                            fetch(
                                event.request
                            )
                        );

                    }
                )

        );

    }
);