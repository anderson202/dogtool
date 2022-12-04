const axios = require('axios');
const { SignatureV4 } = require('@aws-sdk/signature-v4');
const { Sha256 } = require('@aws-crypto/sha256-browser');
const { parseUrl } = require('@aws-sdk/url-parser');
const { HttpRequest } = require('@aws-sdk/protocol-http');

const API_HOST = 'api-gw.dbaas.aircanada.com';

async function fetchCognitoCredentials() {
    const response = await axios.post('https://cognito-identity.us-east-2.amazonaws.com/', {
        IdentityId: 'us-east-2:2e80060b-06f7-49c4-a6c6-b3971bc385bb'
    }, {
        headers: {
            'authority': 'cognito-identity.us-east-2.amazonaws.com',
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.9',
            'amz-sdk-request': 'attempt=1; max=3',
            'cache-control': 'no-cache',
            'content-type': 'application/x-amz-json-1.1',
            'origin': 'https://www.aircanada.com',
            'pragma': 'no-cache',
            'referer': 'https://www.aircanada.com/',
            'sec-ch-ua-mobile': '?0',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'x-amz-target': 'AWSCognitoIdentityService.GetCredentialsForIdentity',
            'x-amz-user-agent': 'aws-sdk-js/3.6.1 os/macOS/10.15.7 lang/js md/browser/Chrome_120.0.0.0 api/cognito_identity/3.6.1 aws-amplify/3.8.23_js'
        }
    })

    return {
        accessKeyId: response.data.Credentials.AccessKeyId,  
        secretAccessKey: response.data.Credentials.SecretKey,
        sessionToken: response.data.Credentials.SessionToken
    };
}

async function fetchData() {
    try {
        // some cookies were returned from this request on the browser, so keeping this here for now - unused.
        const dummyReq = await axios.post('https://www.aircanada.com/IV2PAxfle2/_yFAgX/7nFW/JE3i0bzDkL/DA9yAQ/ZVYrM1kn/GEw', {})
        const cookies = dummyReq.headers['set-cookie'].map(cookie => {
            const firstPart = cookie.split(';')[0];
            return firstPart;
          });
        // Join all the first parts into one big cookie string
        const cookieString = cookies.join('; ');

        const awsCredentials = await fetchCognitoCredentials();

        const url = 'https://akamai-gw.dbaas.aircanada.com/loyalty/dapidynamic/1ASIUDALAC/v2/reward/market-token';
        const endpoint = parseUrl(url);
        const payload = {'itineraries':[{'originLocationCode':'YYZ','destinationLocationCode':'NRT','departureDateTime':'2025-01-01T00:00:00.000'}],'countryOfResidence':'CA'};
        
        const browser_headers = {
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'origin': 'https://www.aircanada.com',
            'referer': 'https://www.aircanada.com/',
            'pragma': 'no-cache',
            'Accept': '*/*',
            'accept-language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Connection':'keep-alive'
        }

        const request = new HttpRequest({
            method: "POST",
            headers: {
                "Host": API_HOST,
            },
            hostname: API_HOST,
            path: endpoint.path,
            protocol: endpoint.protocol,
            body: JSON.stringify(payload)
        });
        
        const signer = new SignatureV4({
            credentials: awsCredentials,
            region: "us-east-2", 
            service: "execute-api",
            sha256: Sha256,
        });
        const signedRequest = await signer.sign(request);

        const request_headers = { ...signedRequest.headers, ...browser_headers };

        // api-gw should be the url behind akamai proxy, so for the signed request we used it
        // but the request we're making should use the akamai-gw host, so we remove it and let axios automatically fill it in for us
        delete request_headers['Host'] 

        const res = await axios.post(url, payload, {
            headers: request_headers,
        });

        console.log(res.data);
    } catch (error) {
      console.error(error.response.data);
    }
}

fetchData(); 