const axios = require("axios");
const QRCode = require("qrcode-terminal");
const { CookieJar } = require("tough-cookie");
const fs = require("fs");

// 配置
const ORIGIN = "https://kys.zzuli.edu.cn";
const SERVICE = encodeURIComponent(
  "https://kys.zzuli.edu.cn/authentication/login/casLogin"
);
const POLL_INTERVAL = 1500;
// const USER_INFO_API = `${ORIGIN}/authentication/member/getUserInfo`;
const USER_INFO_API =
  "https://campus.zzuli.edu.cn/portal-pc/myCenter/getMemberInfoForCurrentMember";

// 生成uuid
function getUuid() {
  return "xxxx4xxxyxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 更全面的 cookie 处理
async function saveCookiesFromResponse(jar, response, url) {
  const cookies = response.headers["set-cookie"];
  if (cookies && cookies.length) {
    console.log(`\n接收到 cookies: ${cookies.length} 个`);
    for (const cookie of cookies) {
      await jar.setCookie(cookie, url);
    }
  }
}

// 递归获取 ticket
async function getTicketRecursive(client, url, maxRedirects = 5, depth = 0) {
  if (depth >= maxRedirects) {
    console.log(`达到最大重定向次数: ${maxRedirects}`);
    return null;
  }

  console.log(`\n尝试访问: ${url}`);

  try {
    const response = await client.get(url, {
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    // 保存服务端设置的 cookies
    await saveCookiesFromResponse(client.defaults.jar, response, url);

    // 打印响应信息
    console.log(`状态码: ${response.status}`);
    console.log(`响应头: ${JSON.stringify(response.headers, null, 2)}`);

    // 提取 ticket (如果有)
    const location = response.headers.location;
    if (location) {
      console.log(`重定向到: ${location}`);
      const ticketMatch = location.match(/[?&]ticket=([^&]+)/);

      if (ticketMatch) {
        const ticket = ticketMatch[1];
        console.log(`获取到 ticket: ${ticket}`);
        return ticket;
      }

      // 如果没有 ticket，则递归跟踪重定向
      const nextUrl = location.startsWith("http")
        ? location
        : new URL(location, url).href;
      return await getTicketRecursive(client, nextUrl, maxRedirects, depth + 1);
    } else if (response.status === 200) {
      // 如果返回 200，检查响应体是否包含重定向脚本
      if (
        typeof response.data === "string" &&
        response.data.includes("window.location.href")
      ) {
        const match = response.data.match(
          /window\.location\.href\s*=\s*['"](.*?)['"]/
        );
        if (match) {
          const nextUrl = match[1];
          console.log(`检测到 JS 重定向到: ${nextUrl}`);
          return await getTicketRecursive(
            client,
            nextUrl,
            maxRedirects,
            depth + 1
          );
        }
      }

      console.log("没有进一步重定向，也没有 ticket");
    }
  } catch (error) {
    console.error(`请求失败: ${error.message}`);
    if (error.response) {
      console.log(`状态码: ${error.response.status}`);
      console.log(`响应头: ${JSON.stringify(error.response.headers, null, 2)}`);
    }
  }

  return null;
}

async function main() {
  const { wrapper } = await import("axios-cookiejar-support");
  const uuid = getUuid();
  let token = "";
  const jar = new CookieJar();
  const client = wrapper(
    axios.create({
      jar,
      withCredentials: true,
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
      },
    })
  );

  // 1. 生成二维码
  const qrUrl = `${ORIGIN}/cas/openAuth?uuid=${uuid}`;
  console.log("请使用官方App扫码以下二维码登录：");
  QRCode.generate(qrUrl, { small: true });
  console.log("扫码链接：", qrUrl);
  console.log("\n开始轮询扫码状态...");

  // 2. 轮询扫码状态
  let ticket = null;
  let pollCount = 0;
  let loginSuccess = false;

  while (!loginSuccess && pollCount < 120) {
    pollCount++;
    try {
      const res = await client.post(
        `${ORIGIN}/cas/casSweepCodeLoginQueryController`,
        new URLSearchParams({ uuid, token }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: ORIGIN,
            Referer: ORIGIN + "/cas/login",
          },
        }
      );

      // 保存cookies
      await saveCookiesFromResponse(
        jar,
        res,
        `${ORIGIN}/cas/casSweepCodeLoginQueryController`
      );

      const json =
        typeof res.data === "string" ? JSON.parse(res.data) : res.data;

      if (json.success && json.obj) {
        if (json.obj.code === "waitSweep") {
          token = json.obj.token;
          process.stdout.write("\r等待扫码...");
        } else if (json.obj.code === "waitAuthorized") {
          token = json.obj.token;
          process.stdout.write("\r已扫码，等待授权...");
        } else if (json.obj.code === "alreadyAuthorized") {
          console.log("\n扫码并授权成功，开始获取ticket...");
          loginSuccess = true;

          // 获取ticket的关键部分
          const loginUrl = `${ORIGIN}/cas/login?service=${SERVICE}`;
          ticket = await getTicketRecursive(client, loginUrl);

          if (!ticket) {
            console.error("未能成功获取ticket，详细检查上面的日志");
          } else {
            console.log(`\n成功获取到ticket: ${ticket}`);
          }
          break;
        } else {
          console.log(`\n扫码状态: ${json.obj.code}`);
          break;
        }
      }
    } catch (e) {
      console.error(`\n轮询异常: ${e.message}`);
      if (e.response) {
        console.log(`状态码: ${e.response.status}`);
      }
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  if (!loginSuccess) {
    console.log("\n未完成扫码登录");
    process.exit(1);
  }

  // 输出当前所有cookies
  console.log("\n当前所有cookies:");
  const allCookies = await jar.getCookies(ORIGIN);
  console.log(allCookies.map((c) => `${c.key}=${c.value}`).join("; "));

  // 用 ticket 进行跨域 SSO 登录，获取 campus.zzuli.edu.cn 的 JSESSIONID
  if (ticket) {
    try {
      console.log("\n用 ticket 进行 SSO 登录 campus.zzuli.edu.cn ...");
      // 1. POST 到 kys.zzuli.edu.cn/cas/login?service=campus登录入口
      const ssoLoginUrl = `${ORIGIN}/cas/login?service=https://campus.zzuli.edu.cn/portal-pc/login/pcLogin`;
      const ssoRes = await client.post(
        ssoLoginUrl,
        new URLSearchParams({ ticket }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: "https://campus.zzuli.edu.cn",
            Referer: "https://campus.zzuli.edu.cn/",
          },
          maxRedirects: 5, // 跟随 campus.zzuli.edu.cn 的多次 302
        }
      );
      console.log(`SSO 登录状态码: ${ssoRes.status}`);
      // 输出 campus.zzuli.edu.cn 的 cookies
      const campusCookies = await jar.getCookies("https://campus.zzuli.edu.cn");
      console.log("\ncampus.zzuli.edu.cn cookies:");
      console.log(campusCookies.map((c) => `${c.key}=${c.value}`).join("; "));
    } catch (e) {
      console.error(`SSO 登录异常: ${e.message}`);
    }
  }

  // 获取用户信息
  try {
    console.log("\n获取用户信息...");
    const userInfoRes = await client.get(USER_INFO_API, {
      headers: {
        Referer: ORIGIN + "/",
        Origin: ORIGIN,
      },
    });

    let userInfo;
    if (typeof userInfoRes.data === "string") {
      if (userInfoRes.data.includes("window.location.href")) {
        console.log("用户信息响应是重定向脚本，可能未正确登录");
        console.log(userInfoRes.data);
      } else {
        try {
          userInfo = JSON.parse(userInfoRes.data);
        } catch (e) {
          console.log("用户信息不是有效JSON");
          console.log(userInfoRes.data);
        }
      }
    } else {
      userInfo = userInfoRes.data;
    }

    console.log("\n用户信息响应类型:", typeof userInfoRes.data);
    console.log("用户信息响应:", userInfoRes.data);

    fs.writeFileSync(
      "./zzuli-user-info.json",
      JSON.stringify(userInfoRes.data, null, 2),
      "utf-8"
    );
    console.log("\n用户信息已保存到 zzuli-user-info.json");
  } catch (e) {
    console.error(`获取用户信息异常: ${e.message}`);
  }
}

main().catch(console.error);
