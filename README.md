# zzuli-node-login

## 项目简介

本项目通过 Node.js 脚本模拟郑州轻工业大学校园门户（campus.zzuli.edu.cn）的 [CAS 单点登录](https://cn.bing.com/search?q=cas%E5%8D%95%E7%82%B9%E7%99%BB%E5%BD%95&PC=U316&FORM=CHROMN)流程，实现 `i轻工大` 扫码登录并获取用户 JESSIONID 用于访问相关接口。

> [!WARNING]
> 注意，单点登录获取到的 JESSIONID 仅用于单域名访问，不可跨域使用。同时避免脚本滥用，仅公布部分可用接口。

## 脚本运行流程

1. 生成二维码，用户用官方 App 扫码登录。
2. 轮询扫码状态，获取 ticket。
3. 用 ticket 进行 SSO 登录 campus.zzuli.edu.cn，自动获取 campus 域下的 JSESSIONID。
4. 用 JSESSIONID 访问 https://campus.zzuli.edu.cn/portal-pc/myCenter/getMemberInfoForCurrentMember 获取用户信息。
5. 用户信息保存为 zzuli-user-info.json。

> [!NOTE]
> 如需了解 zzuli 详细登录流程分析，可以观看我的[博客](https://blog.dogxi.me/zzuli-qrcode)。

## 可公布接口

这里是相关接口文档，脚本使用请下滑至 [依赖安装](#依赖安装)。

由于数量问题，暂时使用 Github 简要记述。

### 目录

1. [用户信息接口](#用户信息接口)
2. [一卡通余额接口](#一卡通余额接口)

### 用户信息

> Dogxi 贡献

**功能**：获取当前登录用户的基本信息。

- **请求方法**：GET
- **请求 URL**：`https://campus.zzuli.edu.cn/portal-pc/myCenter/getMemberInfoForCurrentMember`
- 请求头：
  - Cookie：需要包含有效的 JSESSIONID，该值通过登录流程获取并自动存储在 CookieJar 中。

**请求示例**：

```
GET /portal-pc/myCenter/getMemberInfoForCurrentMember HTTP/1.1
Host: campus.zzuli.edu.cn
Cookie: JSESSIONID=0739AF6AAF99DCD505B582A331A04EAE
```

**响应示例**：

```json
{
  "success": true,
  "msg": "操作成功",
  "obj": {
    "memberId": "5424******06", // 学号
    "memberUsername": "5424******06", // 同学号
    "memberPwd": null, // 密码
    "memberNickname": "奶龙", // 姓名
    "memberSex": 1, // 性别 （0女 1男）
    "memberPhone": "13*******92", // 手机号
    "memberIdNumber": "410***********", //身份证号
    "memberCreateTime": 1725420138000, // 账号创建时间戳
    "memberState": 1, // 不知道
    "memberAcademicNumber": "5424******06", // 学号
    "memberMailbox": "54****0206@email.zzuli.edu.cn", // 邮箱
    "memberSign": "1", // 不知道
    "memberImage": null, // 用户头像
    "memberOtherSchoolNumber": "5424******06", // 学号
    "memberOtherNation": "汉族",
    "memberOtherDepartment": "软件学院", // 学院
    "memberOtherMajor": "数字媒体技术", // 专业
    "memberOtherGrade": "2024", // 年级
    "memberOtherClass": "数媒技术24-02", // 班级
    "memberOtherBirthday": "2006-**-**", // 出生日期
    "memberOtherNative": null,
    "lastLoginTime": "2025年04月29日 18:32", // 上次登录时间
    "quicklyTicket": null,
    "roleCodeList": ["student"], // 身份
    "roleList": [
      {
        "roleCode": "student",
        "roleName": "学生",
        "roleState": null,
        "roleComment": null
      }
    ],
    "deptList": [
      {
        "dptCode": "000215",
        "dptName": "软件学院",
        "dptAbbreviation": null,
        "dptCategoryCode": null,
        "dptEngName": null,
        "dptBelong": null,
        "dptLevel": null,
        "dptSetOtherCode": null,
        "dptSetUpYear": null,
        "dptOriginalStandardCode": null,
        "dptStartTime": null,
        "dptEndTime": null,
        "dptSort": null,
        "dptState": null,
        "dptPublishState": null,
        "children": null,
        "memberList": null,
        "title": "软件学院",
        "name": "软件学院"
      }
    ],
    "deptCodeList": ["000215"],
    "memberIdAesEncrypt": "wxnSLz*LWE*****wf2L*ZgfA%3D%3D", // Aes加密后的学号 加密算法未知
    "memberAesEncrypt": "tW0L3dazaRrw*****ZHwKw%3D%3D",
    "memberCasLastLoginTime": null,
    "memberAppLastLoginTime": null,
    "memberPcLastLoginTime": "2025-04-29 18:32:57",
    "memberSalt": null,
    "memberUpdatePasswordTime": null,
    "memberIdNumberSign": null
  },
  "attributes": null,
  "count": null
}
```

### 一卡通余额接口

> Dogxi 贡献

**功能**：查询一卡通余额及消费记录。

- **请求方法**：GET
- **请求 URL**：`https://microapp.zzuli.edu.cn/microapplication/api/v1/index/ListGeneraCardConsumeRecordByGeneraCardConsumeRecordNumberPage`

- **请求参数**：

  | 参数名                          | 类型   | 必填 | 示例值                           | 描述                               |
  | ------------------------------- | ------ | ---- | -------------------------------- | ---------------------------------- |
  | `generaCardConsumeRecordNumber` | string | 是   | `wxnSLz*LWE*****wf2L*ZgfA%3D%3D` | 用户加密标识（memberIdAesEncrypt） |
  | `pageNum`                       | int    | 是   | `1`                              | 页码                               |
  | `pageSize`                      | int    | 否   | `20`                             | 每页记录数，默认 20                |

**请求示例**：

```http
GET /microapplication/api/v1/index/ListGeneraCardConsumeRecordByGeneraCardConsumeRecordNumberPage?generaCardConsumeRecordNumber=wxnSLz*LWE*****wf2L*ZgfA%3D%3D&pageNum=1&pageSize=100 HTTP/1.1
Host: microapp.zzuli.edu.cn
```

**响应示例**：

```json
{
  "success": true,
  "msg": "操作成功",
  "obj": [
    // json数组
    {
      "generaCardConsumeRecordId": 118929221, // 消费记录Id
      "generaCardConsumeRecordNumber": "5424****06", // 学号
      "generaCardConsumeRecordTransactionTime": "2025-05-10 20:57:19", // 消费时间
      "generaCardConsumeRecordTransactionType": "淋浴支出", // 类型
      "generaCardConsumeRecordTransactionMoney": "0.5", // 消费金额
      "generaCardConsumeRecordTransactionBalance": "8.6", // 剩余金额
      "generaCardConsumeRecordTransactionAdress": "",
      "generaCardConsumeRecordWalletType": "0"
    }
  ],
  "count": 260, // 总消费条数
  "attributes": null
}
```

> [!TIP]
> 如果你发现了更多接口，可以提 issue 或者 Pr 项目进行贡献 =w=

## 依赖安装

```bash
npm install
```

## 本脚本使用方法

```bash
node login.js
或者
npm run start
```

- 按提示扫码并授权。
- 登录成功后，用户信息会自动保存到 zzuli-user-info.json。

## 主要依赖

- axios
- tough-cookie
- axios-cookiejar-support
- qrcode-terminal

## 注意事项

- 需保证网络可访问 kys.zzuli.edu.cn 和 campus.zzuli.edu.cn。
- 若接口变动或登录流程调整，需相应修改脚本。
- 本脚本仅供学习和个人数据获取使用，请勿用于非法用途。

## 开源协议

项目采用 [MIT](LICENSE) 开源协议，也就是你只需要保留署名，就可以对代码进行任意修改。
