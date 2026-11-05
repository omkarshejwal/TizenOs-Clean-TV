#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DEFAULT_SDK_PATH=~/tizen-sdk
DEFAULT_CERT_PATH=tools/certificate-generator/certificates/distributor

echo "Start Patch"

if [ $1 ]
then
	TARGET_PATH=$1/$DEFAULT_CERT_PATH
else
	TARGET_PATH=$DEFAULT_SDK_PATH/$DEFAULT_CERT_PATH
fi

if [ -d $TARGET_PATH ]
then
	cp $DIR/certificates/* $TARGET_PATH
	echo "End Patch"
else
	echo "ERROR - Tizen SDK was not installed or invalid SDK path is input."
fi
