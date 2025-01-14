import express from 'express';
import {ApolloServer, gql} from 'apollo-server-express';
import fs from 'fs';
import https from 'https';
import http from 'http';
import {createRequire} from "module";

const require = createRequire(import.meta.url);
const folgenJson = require('./folgen.json')
const mathefactsJson = require('./mathefacts.json')
const staedtegeschichtenJson = require('./staedtegeschichten.json')

// A schema is a collection of type definitions (hence "typeDefs")
// that together define the "shape" of queries that are executed against
// your data.
const typeDefs = gql`
    type Geschichte {
        titel: String!
        ort: String!
        typ: String!
        geo: [Float]!
        geschichte: String!
    }

    type Staedtegeschichten {
        startzeit: String!
        endzeit: String!
        geschichten: [Geschichte]!
        folge: Folge!
    }

    type Mathefacts {
        startzeit: String!
        endzeit: String!
        thema: String!
        beschreibung: String!
        folge: Folge!
    }

    type Folge {
        folgenId: ID!
        folgenname: String!
        code: String!
    }

    # The "Query" type is special: it lists all of the available queries that
    # clients can execute, along with the return type for each. In this
    # case, the "folgen" query returns an array of zero or more Folge (defined above).
    type Query {
        folgen: [Folge]
        staedtegeschichten: [Staedtegeschichten]
        mathefacts: [Mathefacts]
    }
`;

// Resolvers define the technique for fetching the types defined in the
// schema. This resolver retrieves books from the "folgen" array above.
const resolvers = {
    Query: {
        folgen: () => folgenJson.data,
        staedtegeschichten(parent, args, context, info) {
            let geschichten = []
            const folgen = folgenJson.data

            staedtegeschichtenJson.data.forEach((staedtegeschichtenFolge) => {
                const folgeObj = folgen.find(item => item.folgenId === staedtegeschichtenFolge.folgenId)
                geschichten.push(Object.assign(staedtegeschichtenFolge, {
                            "folge": folgeObj
                        }
                    )
                )
            });
            return geschichten
        },
        mathefacts(parent, args, context, info) {
            let facts = []
            const folgen = folgenJson.data

            mathefactsJson.data.forEach((mathefactsFolge) => {
                const folgeObj = folgen.find(item => item.folgenId === mathefactsFolge.folgenId)
                facts.push(Object.assign(mathefactsFolge, {
                            "folge": folgeObj
                        }
                    )
                )
            });
            return facts
        }
    }
};

async function startApolloServer() {
    const configurations = {
        // Note: You may need sudo to run on port 443
        production: {ssl: true, port: 443, hostname: 'data.hobbylos.online'},
        development: {ssl: false, port: 4000, hostname: 'localhost'},
    };
    const environment = process.env.NODE_ENV || 'production';
    const config = configurations[environment];

    const server = new ApolloServer({
        typeDefs,
        resolvers,
        csrfPrevention: true,
    });
    await server.start();

    const app = express();
    server.applyMiddleware({app});

    // Create the HTTPS or HTTP server, per configuration
    let httpServer;

    if (config.ssl) {
        // Assumes certificates are in a .ssl folder off of the package root.
        // Make sure these files are secured.
        httpServer = https.createServer(
            {
                key: fs.readFileSync(`//ssl/data.hobbylos.online/server.key`),
                cert: fs.readFileSync(`//ssl/data.hobbylos.online/server.crt`),
            },

            app,
        );
    } else {
        httpServer = http.createServer(app);
    }

    await new Promise(resolve =>
        httpServer.listen({port: config.port}, resolve),
    );

    console.log(
        '🚀 Server ready at',
        `http${config.ssl ? 's' : ''}://${config.hostname}:${config.port}${
            server.graphqlPath
        }`,
    );

    return {server, app};
}

startApolloServer()
