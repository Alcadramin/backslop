<?php

final class Money
{
    public static function formatMoney(int $cents): string
    {
        $value = number_format($cents / 100, 2, ',', '.');
        $sign = $cents < 0 ? '-' : '';
        return $sign . $value . ' TL';
    }

    public static function formatPrice(int $amount): string // expect: duplicate-helper
    {
        $value = number_format($amount / 100, 2, ',', '.');
        $sign = $amount < 0 ? '-' : '';
        return $sign . $value . ' TL';
    }
}
