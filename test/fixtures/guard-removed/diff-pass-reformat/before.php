<?php

class ChangePasswordController extends Controller
{
    public function __invoke(ChangePasswordRequest $request)
    {
        abort_if($this->user->is_sso, Response::HTTP_FORBIDDEN, 'Password is managed by your SSO provider.');
        $this->users->updatePassword($this->user, $request->new_password);
    }
}
