import { terser } from "rollup-plugin-terser";

export default {
    input: "src/Base91.js",
    output: [ 
        {   
            format: "iife",
            name: "Base91",
            file: "dist/Base91.iife.js"
        },
        {   
            format: "iife",
            name: "Base91",
            file: "dist/Base91.iife.min.js",
            plugins: [terser()]
        },
        {   
            format: "es",
            name: "Base91",
            file: "dist/Base91.esm.js"
        },
        {   
            format: "es",
            name: "Base91",
            file: "dist/Base91.esm.min.js",
            plugins: [terser()]
        },
    ]
};
