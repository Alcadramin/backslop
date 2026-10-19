<?php
namespace App\Mail;

use Vonage\Client;

// `new Client()` that is not Guzzle
$client = new Client(new Basic($key, $secret));
$sms = new Client();
