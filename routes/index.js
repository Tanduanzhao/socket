let {wx,url} = require('../config.js');
const user = require('../models/user.js');
const request = require('request');
const moment = require('moment');
function getUserInfo(code,from){
    console.log('通过微信获取用户openId');
    return getUserInfoByCode(code)
            .then((codeResult)=>{
                if(!!codeResult){
                    return codeResult;
                }else{
                    return getOpenIdFromCode(code)
                            .then((result)=>{
                            return getUserInfoFromOpenId(result.openid)
                                    .then((oUserInfo)=>{
                                        if(!oUserInfo){
                                            return getUserInfoFromWx(result.access_token,result.openid)
                                                    .then((_userInfo)=>{
                                                        _userInfo.openId = _userInfo.openid;
                                                        _userInfo.wxUsername = _userInfo.nickname;
                                                        _userInfo.wxImgUrl = _userInfo.headimgurl;
                                                        return saveUserInfo({
                                                               subScribe:result.subScribe,
                                                               wxId:result.openid,
                                                               wxName:_userInfo.nickname,
                                                               wxImage:_userInfo.headimgurl,
                                                               wxCode:code,
                                                               parent:from
                                                           })
                                                           .then((saveResult)=>{
                                                               return updateMasterFriends(from,saveResult._id)
                                                                       .then((result)=>{
                                                                           return saveResult;
                                                                       });
                                                           })
                                                    })
                                        }else{
                                            console.log('通过openId更新code',oUserInfo);
                                            return updateCodeById(oUserInfo._id,code,from)
                                                    .then((result)=>{
                                                        return oUserInfo;
                                                    })

                                        }
                                    })

                        })
                }
            })
}

function getOpenIdFromCode(code){
    return new Promise((resolve,reject)=>{
        request(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${wx.appId}&secret=${wx.AppSecret}&code=${code}&grant_type=authorization_code`,(err,response,body)=>{
            if(!err){
                body = JSON.parse(body);
                resolve(body)
            }else{
                reject(err)
            }
        })
    })
}

function getUserInfoFromWx(accessToken,openId){
    return new Promise((resolve,reject)=>{
        request(`https://api.weixin.qq.com/sns/userinfo?access_token=${accessToken}&openid=${openId}&lang=zh_CN`,(err,response,body)=>{
            if(!err){
                body = JSON.parse(body);
                resolve(body);
            }else{
                reject(err);
            }
        })
    })
}

function saveUserInfo(obj){
    return new Promise((resolve,reject)=>{
        new user(obj)
            .save((err,result)=>{
                if(err){
                    reject(err);
                }else{
                    resolve(result);
                }
            })
    })
}

function updateMasterFriends(id,whoId){
   return user.findOne().where({_id:id}).exec((err,result)=>{
        if(err){
            throw new Error(err);
        }else{
            if(!!result){
                if(result.friends.indexOf(whoId)=== -1){
                    result.friends.unshift(whoId);
                    result.markModified('friends');
                    result.save((err,_r)=>{
                        if(err){
                            throw new Error(err);
                        }else{
                            return _r;
                        }
                    })
                }
            }
        }
    })
}

function getUserInfoByCode(code){
    return user
            .findOne()
            .where({wxCode:code})
            .exec((err,result)=>{
                if(err){
                    throw new Error()
                }else{
                    console.log(result,"查询根据code查询用户表");
                    return result;
                }
            })
}

//根据用户id更新code
function updateCodeById(id,code,from){
    let updateUserCode={
        wxCode:code
    }
    if(!!from){
        updateUserCode.parent = from;
     return user.findOne().where({_id:from}).exec((err,result)=>{
            if(err){
                throw new Error(err)
            }else{
                if(result.friends.indexOf(id)=== -1){
                    result.friends.push(id);
                    result.markModified('friends');
                    result.save((err,_r)=>{
                        if(err){
                            throw new Error(err);
                        }
                    })
                }
              return new Promise((resolve,reject)=>{
                user.update({_id:id},{$set:updateUserCode},(err,_result)=>{
                  if(err){
                    reject(err);
                  }else {
                    resolve(result);
                  }
                })
              })
            }
        })
    }else{
        return new Promise((resolve,reject)=>{
            user.update({_id:id},{$set:updateUserCode},(err,result)=>{
                if(err){
                  reject(err);
                }else {
                  console.log(result,"resultupdateCodeById");
                  resolve(result);
                }
            })
        })
    }
}

function getUserInfoFromDb(openId){
    return user
            .find()
            .where({wxId:openId})
            .exec((err,result)=>{
                if(err){
                    throw new Error('根据openId读取用户信息失败:',openId);
                }else{
                    return result;
                }
            })
}

function getUserInfoFromOpenId(openId){
    return user
            .findOne()
            .where({wxId:openId})
            .exec((err,result)=>{
                if(err){
                    throw new Error('根据openId查询数据库里面用户信息失败');
                }else{
                    console.log(openId,'openId');
                    console.log(result,'resultaaaa');
                    return result;
                }
            })
}

function updateUserFrom(id,from){
    return new Promise((resolve,reject)=>{
        user
            .update({_id:id},{$set:{from:from}},(err,result)=>{
                if(err){
                    reject(err)
                }else{
                    resolve(result);
                }
            })
    })
}

module.exports = (req,res,next)=>{
    if(!req.query.code){
        res.redirect(`https://open.weixin.qq.com/connect/oauth2/authorize?appid=${wx.appId}&redirect_uri=${url+req.originalUrl}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`);
    }else{
        getUserInfo(req.query.code,req.query.from)
            .then((userInfo)=>{
                console.log(userInfo,"用户信息");
                date = moment(new Date).format('a|HH:mm').split('|');
                res.render('index',{title:"聊天",userInfo:userInfo,parent:userInfo.parent,wxImage:userInfo.wxImage,date:date});
            })
    }
}
