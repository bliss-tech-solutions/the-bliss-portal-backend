const createAccountSignInApiController = {
    // GET /api/createaccountsignin/check - Check if admin sign-in API is available
    check: async (req, res, next) => {
        try {
            res.status(200).json({
                success: true,
                message: 'Create Account Sign-In API is available',
                data: {
                    apiName: 'CreateAccountSignInApi',
                    version: '1.0.0',
                    endpoints: {
                        signIn: 'POST /api/createaccountsignin/signin',
                        check: 'GET /api/createaccountsignin/check'
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/createaccountsignin/signin - Admin sign-in validation
    signIn: async (req, res, next) => {
        try {
            const { CodeNo, Email, Password } = req.body;

            // Validate required fields
            if (!CodeNo || !Email || !Password) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: CodeNo, Email, and Password are required'
                });
            }

            // Admin credentials (hardcoded as per requirements)
            const ADMIN_CODE_NO = 'BMMPK';
            const ADMIN_EMAIL = 'HR@bliss.com';
            const ADMIN_PASSWORD = 'HR@Bliss0123';

            // Validate credentials
            const isCodeNoValid = CodeNo === ADMIN_CODE_NO;
            const isEmailValid = Email === ADMIN_EMAIL;
            const isPasswordValid = Password === ADMIN_PASSWORD;

            if (!isCodeNoValid || !isEmailValid || !isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials. Access denied.',
                    data: {
                        authenticated: false,
                        errors: {
                            codeNo: !isCodeNoValid ? 'Invalid CodeNo' : null,
                            email: !isEmailValid ? 'Invalid Email' : null,
                            password: !isPasswordValid ? 'Invalid Password' : null
                        }
                    }
                });
            }

            // All credentials are valid
            res.status(200).json({
                success: true,
                message: 'Sign-in successful. Access granted.',
                data: {
                    authenticated: true,
                    accessGranted: true,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = createAccountSignInApiController;

