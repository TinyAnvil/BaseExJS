var Base91 = (function (exports) {
    'use strict';

    /*
     * [BaseEx]{@link https://github.com/UmamiAppearance/BaseExJS}
     *
     * @version 0.3.2
     * @author UmamiAppearance [mail@umamiappearance.eu]
     * @license GPL-3.0 AND BSD-3-Clause (Base91, Copyright (c) 2000-2006 Joachim Henke)
     */


    class Base91 {
        /*
            En-/decoding to and from Base91.
            -------------------------------
            
            This is an implementation of Joachim Henkes method to
            encode binary data as ASCII characters -> basE91
            http://base91.sourceforge.net/

            As this method requires to split the bytes, the default
            conversion class "BaseExConv" is not used in this case.
            (Requires "BaseExUtils")
        */
        constructor(version="default", input="str", output="str") {
            /*
                The default charset gets initialized, as well as
                some utilities.
            */
            this.charsets = {
                default: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~\""
            };
            
            this.IOtypes = ["str", "bytes"];

            this.utils = new BaseExUtils(this);
            this.utils.binPow = {
                13: 2**13,
                14: 2**14
            };
            this.utils.divmod = (x, y) => [Math.floor(x / y), x % y];
            
            [this.version, this.defaultInput, this.defaultOutput] = this.utils.validateArgs([version, input, output]);
        }

        encode(input, ...args) {
            /* 
                Encode from string or bytes to base92.
                -------------------------------------

                @input: string or (typed) array of bytes
                @args:
                    "str"       :  tells the encoder, that input is a string (default)
                    "bytes"     :  tells the encoder, that input is an array
                    "default"   :  default charset 
            */
           
            // Argument validation and input settings
            args = this.utils.validateArgs(args);
            const inputType = this.utils.setIOType(args, "in");
            const version = this.utils.getVersion(args);
            input = this.utils.validateInput(input, inputType);

            // Convert to bytes if input is a string
            const inputBytes = (inputType === "str") ? new TextEncoder().encode(input) : input;

            // As this base representation splits the bytes
            // the read bits need to be stores somewhere. 
            // This is done in "bitCount". "n", similar to 
            // other solutions here, holds the integer which
            // is converted to the desired base.

            let bitCount = 0;
            let n = 0;
            let output = "";

            // Shortcut
            const chars = this.charsets[version];

            inputBytes.forEach(byte => {
                //n = n + byte * 2^bitcount;
                n += (byte << bitCount);

                // Add 8 bits forEach byte
                bitCount += 8;
                
                // If the count exceeds 13 bits, base convert the
                // current frame.

                if (bitCount > 13) {

                    // Set bit amount "count" to 13, check the
                    // remainder of n % 2^13. If it is 88 or 
                    // lower. Take one more bit from the stream
                    // and calculate the remainder for n % 2^14.

                    let count = 13;
                    let rN = n % this.utils.binPow[13];

                    if (rN < 89) {
                        count = 14;
                        rN = n % this.utils.binPow[14];
                    }

                    // Remove 13 or 14 bits from the integer,
                    // decrease the bitCount by the same amount.
                    n >>= count;
                    bitCount -= count;
                    
                    // Calculate quotient and remainder from
                    // the before calculated remainder of n 
                    // -> "rN"
                    let q, r;
                    [q, r] = this.utils.divmod(rN, 91);

                    // Lookup the corresponding characters for
                    // "r" and "q" in the set, append it to the 
                    // output string.
                    output = `${output}${chars[r]}${chars[q]}`;
                }
            });
            
            // If the bitCount is not zero at the end,
            // calculate quotient and remainder of 91
            // once more.
            if (bitCount) {
                let q, r;
                [q, r] = this.utils.divmod(n, 91);

                // The remainder is concatenated in any case
                output = output.concat(chars[r]);

                // The quotient is also appended, but only
                // if the bitCount still has the size of a byte
                // or n can still represent 91 conditions.
                if (bitCount > 7 || n > 90) {
                    output = output.concat(chars[q]);
                }
            }
            
            return output;
        }

        decode(input, ...args) {
            /* 
                Decode from base91 string to utf8-string or bytes.
                -------------------------------------------------

                @input: base91-string
                @args:
                    "str"       :  tells the encoder, that output should be a string (default)
                    "bytes"     :  tells the encoder, that output should be an array
                    "default"   :  sets the used charset to this variant
            */

            // Argument validation and output settings
            args = this.utils.validateArgs(args);
            const version = this.utils.getVersion(args);
            const outputType = this.utils.setIOType(args, "out");
            
            //remove all whitespace from input
            input = String(input).replace(/\s/g,'');
            
            let l = input.length;

            // For starters leave the last char behind
            // if the length of the input string is odd.

            let odd = false;
            if (l % 2) {
                odd = true;
                l--;
            }

            // Set again integer n for base conversion.
            // Also initialize a bitCount(er)

            let n = 0;
            let bitCount = 0;
            const chars = this.charsets[version];
            
            // Initialize an ordinary array
            const b256Array = new Array();
            
            // Walk through the string in steps of two
            // (aka collect remainder- and quotient-pairs)
            for (let i=0; i<l; i+=2) {

                // Calculate back the remainder of the integer "n"
                const rN = chars.indexOf(input[i]) + chars.indexOf(input[i+1]) * 91;
                n = (rN << bitCount) + n;
                bitCount += (rN % this.utils.binPow[13] > 88) ? 13 : 14;

                // calculate back the individual bytes (base256)
                do {
                    b256Array.push(n % 256);
                    n >>= 8;
                    bitCount -= 8;
                } while (bitCount > 7);
            }

            // Calculate the last byte if the input is odd
            // and add it
            if (odd) {
                const lastChar = input.charAt(l);
                const rN = chars.indexOf(lastChar);
                b256Array.push(((rN << bitCount) + n) % 256);
            }

            const output = Uint8Array.from(b256Array);

            // Return the output, convert to utf8-string if requested
            if (outputType === "bytes") {
                return output;
            } else {
                return new TextDecoder().decode(output);
            }

        }
    }


    class BaseExUtils {
        /*
            Utilities for every BaseEx class.
            The main purpose is argument validation.
        */

        constructor(main) {

            // Store the calling class in this.root
            // for accessability.
            this.root = main;

            // If charsets are uses by the parent class,
            // add extra functions for the user.
            if ("charsets" in main) this.charsetUserToolsConstructor();
        }

        charsetUserToolsConstructor() {
            /*
                Constructor for the ability to add a charset and 
                change the default version.
            */

            this.root.addCharset = (name, charset) => {
                /*
                    Save method to add a charset.
                    ----------------------------

                    @name: string that represents the key for the new charset
                    @charset: string, array or Set of chars - the length must fit to the according class 
                */
                    
                if (typeof name !== "string") {
                    throw new TypeError("The charset name must be a string.");
                }

                // Get the appropriate length for the charset
                // from the according converter
                
                const setLen = this.root.converter.radix;
                let inputLen = setLen;
                
                if (typeof charset === "string" || Array.isArray(charset)) {
                    
                    // Store the input length of the input
                    inputLen = charset.length;
                    
                    // Convert to "Set" -> eliminate duplicates
                    // If duplicates are found the length of the
                    // Set and the length of the initial input
                    // differ.

                    charset = new Set(charset);

                } else if (!(charset instanceof Set)) {
                    throw new TypeError("The charset must be one of the types:\n'str', 'set', 'array'.");
                }
                
                if (charset.size === setLen) {
                    charset = [...charset].join("");
                    this.root.charsets[name] = charset;
                    console.log(`New charset added with the name '${name}' added and ready to use`);
                } else if (inputLen === setLen) {
                    throw new Error("There were repetitive chars found in your charset. Make sure each char is unique.");
                } else {
                    throw new Error(`The the length of the charset must be ${setLen}.`);
                }
            };

            // Save method (argument gets validated) to 
            // change the default version.
            this.root.setDefaultVersion = (version) => [this.root.version] = this.validateArgs([version]);
        }

        makeArgList(args) {
            /*
                Returns argument lists for error messages.
            */
            return args.map(s => `'${s}'`).join(", ")
        }

        setIOType(args, IO) {
            /* 
                Set type for input or output (bytes or string).
            */
            let type;
            if (args.includes("bytes")) {
                type = "bytes";
            } else if (args.includes("str")) { 
                type = "str";
            } else {
                type = (IO === "in") ? this.root.defaultInput : this.root.defaultOutput;
            }

            return type;
        }

        getVersion(args) {
            /*
                Test which version (charset) should be used.
                Sets either the default or overwrites it if
                requested.
            */
            let version = this.root.version;
            args.forEach(arg => {
                if (arg in this.root.charsets) {
                    version = arg; 
                }
            });
            return version;
        }

        validateArgs(args) {
            /* 
                Test if provided arguments are in the argument list.
                Everything gets converted to lowercase and returned
            */
            let versions = null;
            let validArgs;
            const loweredArgs = new Array();

            if ("charsets" in this.root) {
                versions = Object.keys(this.root.charsets);
                validArgs = [...this.root.IOtypes, ...versions];
            } else {
                validArgs = this.root.IOtypes;
            }

            if (args.length) {
                args.forEach(arg => {
                    arg = String(arg).toLowerCase();
                    if (!validArgs.includes(arg)) {
                        const versionHint = (versions) ? `The options for version (charset) are:\n${this.makeArgList(versions)}\n\n` : "";
                        throw new TypeError(`'${arg}'\n\nValid arguments for in- and output-type are:\n${this.makeArgList(this.root.IOtypes)}\n\n${versionHint}Traceback:`);
                    }
                    loweredArgs.push(arg);
                });
            }
            return loweredArgs;
        }

        validateInput(input, inputType) {
            /* 
                Test if input type fits to the actual input.
            */
            if (inputType === "str") {
                if (typeof input !== "string") {
                    this.warning("Your input was converted into a string.");
                }
                return String(input);
            } else {
                if (typeof input === "string") {
                    throw new TypeError("Your provided input is a string, but some kind of (typed) Array is expected.");
                } else if (!(ArrayBuffer.isView(input) || Array.isArray(input))) {
                    throw new TypeError("Input must be some kind of (typed) Array if input type is set to 'bytes'.");
                }
                return input; 
            }
        }

        warning(message) {
            if (Object.prototype.hasOwnProperty.call(console, "warn")) {
                console.warn(message);
            } else {
                console.log(`___\n${message}\n`);
            }
        }
    }

    exports.Base91 = Base91;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
