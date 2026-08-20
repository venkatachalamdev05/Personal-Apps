const DB_NAME = "daily_tracker_db";
const DB_VERSION = 1;

let database = null;


// =====================================================
// OPEN DATABASE
// =====================================================

function openDatabase() {

    return new Promise((resolve, reject) => {

        const request =
            indexedDB.open(
                DB_NAME,
                DB_VERSION
            );


        request.onupgradeneeded = (event) => {

            const db =
                event.target.result;


            if (
                !db.objectStoreNames
                    .contains("categories")
            ) {

                db.createObjectStore(
                    "categories",
                    {
                        keyPath: "id"
                    }
                );

            }


            if (
                !db.objectStoreNames
                    .contains("tracking")
            ) {

                const store =
                    db.createObjectStore(
                        "tracking",
                        {
                            keyPath: "id"
                        }
                    );


                store.createIndex(
                    "category_date",
                    [
                        "category_id",
                        "date"
                    ],
                    {
                        unique: true
                    }
                );

            }

        };


        request.onsuccess = () => {

            database =
                request.result;

            resolve(database);

        };


        request.onerror = () => {

            reject(
                request.error
            );

        };

    });

}


// =====================================================
// GET ALL
// =====================================================

function getAll(storeName) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                database.transaction(
                    storeName,
                    "readonly"
                );


            const store =
                transaction
                    .objectStore(
                        storeName
                    );


            const request =
                store.getAll();


            request.onsuccess = () => {

                resolve(
                    request.result
                );

            };


            request.onerror = () => {

                reject(
                    request.error
                );

            };

        }
    );

}


// =====================================================
// PUT
// =====================================================

function put(storeName, data) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                database.transaction(
                    storeName,
                    "readwrite"
                );


            const store =
                transaction
                    .objectStore(
                        storeName
                    );


            const request =
                store.put(data);


            request.onsuccess = () => {

                resolve(
                    request.result
                );

            };


            request.onerror = () => {

                reject(
                    request.error
                );

            };

        }
    );

}


// =====================================================
// CLEAR
// =====================================================

function clearStore(storeName) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                database.transaction(
                    storeName,
                    "readwrite"
                );


            const store =
                transaction
                    .objectStore(
                        storeName
                    );


            const request =
                store.clear();


            request.onsuccess = () => {

                resolve();

            };


            request.onerror = () => {

                reject(
                    request.error
                );

            };

        }
    );

}


// =====================================================
// DELETE
// =====================================================

function deleteRecord(
    storeName,
    id
) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                database.transaction(
                    storeName,
                    "readwrite"
                );


            const store =
                transaction
                    .objectStore(
                        storeName
                    );


            const request =
                store.delete(id);


            request.onsuccess = () => {

                resolve();

            };


            request.onerror = () => {

                reject(
                    request.error
                );

            };

        }
    );

}