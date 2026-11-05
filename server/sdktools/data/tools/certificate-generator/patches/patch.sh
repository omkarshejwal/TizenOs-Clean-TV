#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DEFAULT_SDK_PATH=~/tizen-sdk
DEFAULT_CERT_PATH=tools/certificate-generator/certificates/distributor
PRIVILEGE_LEVEL=public

echo "Start Patch"

if [ "$1" = "public" ];
then
    PRIVILEGE_LEVEL=public
elif [ "$1" = "partner" ];
then
    PRIVILEGE_LEVEL=partner
else
    echo "Invalid parameter: $1"
    echo
    cat README.txt
    echo
    exit
fi

if [ $2 ]
then
	TARGET_PATH=$2/$DEFAULT_CERT_PATH
else
	TARGET_PATH=../certificates/distributor 
fi

if [ -d $TARGET_PATH ]
then
	cp $DIR/$PRIVILEGE_LEVEL/certificates/* $TARGET_PATH -rf
	echo "End Patch"
else
	echo "ERROR - Tizen SDK was not installed or invalid SDK path: $2"
fi
