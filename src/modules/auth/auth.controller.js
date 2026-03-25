import * as authService from "./auth.service.js";

export const register = async (req, res) => {
  try {
    const result = await authService.registerUser(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const result = await authService.loginUser(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
};

export const me = async (req, res) => {
  try {
    const user = await authService.getMe(req.userId);
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};
